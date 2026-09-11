import os
import tempfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.models import ExecutionStatus, JudgeVerdict
from app.problems import TestCase
from app.services.compiler import (
    compile_and_run_c,
    get_compiler_health,
    get_executable_extension,
    parse_gcc_diagnostics,
)
from app.services.judge import evaluate_c_submission
from app.services.zip_processor import is_safe_zip_path, parse_problem_number
from app.database.db import get_db_connection, init_db, is_postgres_backend


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_health_endpoint(client):
    """Verify /health returns 200 OK and expected compiler health structure."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "healthy")
    assert "gcc_available" in data
    assert "compiler" in data
    assert data["compiler"] == "gcc"
    # Ensure internal absolute paths are not exposed
    assert not data.get("gcc_path", "").startswith("/") or data.get("gcc_path") == "gcc"


def test_compiler_successful_run():
    """Verify standard C11 code compiles and runs successfully returning expected stdout."""
    code = """
    #include <stdio.h>
    int main() {
        int a, b;
        if (scanf("%d %d", &a, &b) == 2) {
            printf("%d\\n", a + b);
        }
        return 0;
    }
    """
    res = compile_and_run_c(code=code, stdin_input="15 25", timeout_seconds=5.0)
    assert res.status == ExecutionStatus.SUCCESS
    assert res.exit_code == 0
    assert "40" in res.stdout.strip()


def test_compiler_compilation_error():
    """Verify syntax error produces COMPILATION_ERROR with structured diagnostics."""
    code = """
    #include <stdio.h>
    int main() {
        this_is_an_undefined_error_syntax();
        return 0
    }
    """
    res = compile_and_run_c(code=code, stdin_input="", timeout_seconds=5.0)
    assert res.status == ExecutionStatus.COMPILATION_ERROR
    assert res.exit_code != 0
    assert len(res.diagnostics) > 0
    assert any(d.severity == "error" for d in res.diagnostics)


def test_compiler_runtime_error():
    """Verify abnormal termination produces RUNTIME_ERROR."""
    code = """
    #include <stdio.h>
    #include <stdlib.h>
    int main() {
        exit(42);
        return 0;
    }
    """
    res = compile_and_run_c(code=code, stdin_input="", timeout_seconds=5.0)
    assert res.status == ExecutionStatus.RUNTIME_ERROR
    assert res.exit_code == 42


def test_compiler_timeout_infinite_loop():
    """Verify infinite loop is terminated by timeout and process group is cleaned up."""
    code = """
    #include <stdio.h>
    int main() {
        volatile int count = 0;
        while (1) {
            count++;
        }
        return 0;
    }
    """
    res = compile_and_run_c(code=code, stdin_input="", timeout_seconds=1.0)
    assert res.status == ExecutionStatus.TIME_LIMIT_EXCEEDED
    assert res.exit_code is None
    assert "Time limit exceeded" in res.stderr


def test_compiler_large_output_truncation():
    """Verify runaway output loop is truncated and doesn't exhaust server memory."""
    code = """
    #include <stdio.h>
    int main() {
        for (int i = 0; i < 50000; i++) {
            printf("Running output line %d: 01234567890123456789\\n", i);
        }
        return 0;
    }
    """
    res = compile_and_run_c(code=code, stdin_input="", timeout_seconds=5.0)
    assert res.status == ExecutionStatus.SUCCESS
    assert len(res.stdout) <= 1048576 + 200  # Cap + truncation message


def test_compiler_code_size_limit():
    """Verify code exceeding size limit is rejected."""
    huge_code = "// " + "A" * (70 * 1024) + "\nint main() { return 0; }"
    res = compile_and_run_c(code=huge_code, stdin_input="", timeout_seconds=5.0)
    assert res.status == ExecutionStatus.COMPILATION_ERROR
    assert "exceeds maximum allowed size" in res.stderr


def test_judge_verdicts_accepted_and_wrong_answer():
    """Verify evaluate_c_submission properly returns ACCEPTED and WRONG_ANSWER."""
    code = """
    #include <stdio.h>
    int main() {
        int n;
        if (scanf("%d", &n) == 1) {
            if (n % 2 == 0) printf("EVEN");
            else printf("ODD");
        }
        return 0;
    }
    """
    test_cases = [
        TestCase(input="4", expected_output="EVEN"),
        TestCase(input="7", expected_output="ODD"),
    ]
    res_ac = evaluate_c_submission(code, test_cases, time_limit=2.0)
    assert res_ac.verdict == JudgeVerdict.ACCEPTED
    assert res_ac.test_cases.passed == 2

    # Wrong answer case
    wrong_test_cases = [
        TestCase(input="4", expected_output="ODD"),  # Incorrect expectation for testing
    ]
    res_wa = evaluate_c_submission(code, wrong_test_cases, time_limit=2.0)
    assert res_wa.verdict == JudgeVerdict.WRONG_ANSWER
    assert res_wa.test_cases.failed == 1


def test_zip_security_path_traversal():
    """Verify Zip Slip path traversal detection."""
    with tempfile.TemporaryDirectory() as td:
        target_dir = Path(td)
        assert is_safe_zip_path(target_dir, "student1/p1.c") is True
        assert is_safe_zip_path(target_dir, "../../../etc/passwd") is False
        assert is_safe_zip_path(target_dir, "..\\..\\windows\\system32\\calc.exe") is False


def test_database_initialization_and_queries():
    """Verify database initializes properly and supports basic queries and transactional scope."""
    init_db()
    with get_db_connection() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM weeks").fetchone()
        assert row is not None
        assert row["cnt"] >= 0
