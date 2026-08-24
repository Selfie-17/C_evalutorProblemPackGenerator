import tempfile
from pathlib import Path
from typing import List, Optional

from app.models import (
    CustomTestCase,
    JudgeStatus,
    RunCustomTestCasesResponse,
    SubmitCodeResponse,
    TestCaseExecutionResult,
)
from app.problems import get_problem
from app.services.compiler import compile_source_file, execute_binary


def normalize_output(text: str) -> str:
    """Normalize output by stripping trailing whitespace and normalizing newline characters."""
    lines = [line.rstrip() for line in text.strip().splitlines()]
    return "\n".join(lines)


def judge_solution(
    problem_id: str,
    code: str,
    custom_timeout: Optional[float] = None,
) -> SubmitCodeResponse:
    """
    Judge a submitted C solution against problem test cases:
    1. Look up problem by ID.
    2. Enforce server-controlled problem timeout limit.
    3. Compile code ONCE into an executable binary.
    4. Run executable against test cases sequentially.
    5. Compare normalized actual output with expected output.
    6. Stop on first failure and return verdict (protecting hidden test case data).
    7. Return 'accepted' if all test cases pass.
    """
    problem = get_problem(problem_id)
    if not problem:
        return SubmitCodeResponse(
            status=JudgeStatus.INTERNAL_ERROR,
            problem_id=problem_id,
            stderr=f"Problem '{problem_id}' not found.",
        )

    # Server strictly enforces problem time limit as maximum
    effective_timeout = problem.time_limit
    if custom_timeout is not None:
        effective_timeout = max(0.1, min(custom_timeout, problem.time_limit))

    all_cases = problem.all_test_cases
    total_test_cases = len(all_cases)

    with tempfile.TemporaryDirectory(prefix="c_judge_") as temp_dir:
        temp_path = Path(temp_dir)
        source_file = temp_path / "solution.c"
        executable_file = temp_path / "solution.exe"

        # 1. Write source code
        try:
            source_file.write_text(code, encoding="utf-8")
        except Exception as e:
            return SubmitCodeResponse(
                status=JudgeStatus.INTERNAL_ERROR,
                problem_id=problem_id,
                stderr=f"Failed to write source code: {str(e)}",
            )

        # 2. Compile ONCE
        is_compiled, compilation_output, compile_code = compile_source_file(
            source_file=source_file,
            executable_file=executable_file,
            temp_dir=temp_dir,
        )

        if not is_compiled:
            return SubmitCodeResponse(
                status=JudgeStatus.COMPILATION_ERROR,
                problem_id=problem_id,
                total_test_cases=total_test_cases,
                passed_test_cases=0,
                compilation_output=compilation_output,
            )

        # 3. Sequential test case runner
        passed_count = 0
        total_time_ms = 0.0
        max_time_ms = 0.0

        for idx, test_case in enumerate(all_cases, start=1):
            exit_code, stdout, stderr, elapsed_ms, is_timeout = execute_binary(
                executable_file=executable_file,
                temp_dir=temp_dir,
                stdin_data=test_case.input,
                timeout=effective_timeout,
            )

            total_time_ms += elapsed_ms
            max_time_ms = max(max_time_ms, elapsed_ms)

            # Check Timeout (TLE)
            if is_timeout:
                return SubmitCodeResponse(
                    status=JudgeStatus.TIME_LIMIT_EXCEEDED,
                    problem_id=problem_id,
                    total_test_cases=total_test_cases,
                    passed_test_cases=passed_count,
                    failed_test_case=idx,
                    input=None if test_case.is_hidden else test_case.input,
                    expected_output=None if test_case.is_hidden else test_case.expected_output,
                    actual_output=None,
                    stderr=f"Time limit exceeded ({effective_timeout:.2f}s) on test case {idx}.",
                    total_execution_time_ms=round(total_time_ms, 2),
                    max_execution_time_ms=round(max_time_ms, 2),
                )

            # Check Runtime Error (Crash / Non-zero exit)
            if exit_code != 0:
                return SubmitCodeResponse(
                    status=JudgeStatus.RUNTIME_ERROR,
                    problem_id=problem_id,
                    total_test_cases=total_test_cases,
                    passed_test_cases=passed_count,
                    failed_test_case=idx,
                    input=None if test_case.is_hidden else test_case.input,
                    expected_output=None if test_case.is_hidden else test_case.expected_output,
                    actual_output=None if test_case.is_hidden else stdout,
                    stderr=stderr or f"Process exited with non-zero code {exit_code}.",
                    total_execution_time_ms=round(total_time_ms, 2),
                    max_execution_time_ms=round(max_time_ms, 2),
                )

            # Compare actual output vs expected output
            actual_normalized = normalize_output(stdout)
            expected_normalized = normalize_output(test_case.expected_output)

            if actual_normalized != expected_normalized:
                return SubmitCodeResponse(
                    status=JudgeStatus.WRONG_ANSWER,
                    problem_id=problem_id,
                    total_test_cases=total_test_cases,
                    passed_test_cases=passed_count,
                    failed_test_case=idx,
                    input=None if test_case.is_hidden else test_case.input,
                    expected_output=None if test_case.is_hidden else test_case.expected_output,
                    actual_output=None if test_case.is_hidden else stdout,
                    total_execution_time_ms=round(total_time_ms, 2),
                    max_execution_time_ms=round(max_time_ms, 2),
                )

            passed_count += 1

        # All test cases passed
        return SubmitCodeResponse(
            status=JudgeStatus.ACCEPTED,
            problem_id=problem_id,
            total_test_cases=total_test_cases,
            passed_test_cases=passed_count,
            total_execution_time_ms=round(total_time_ms, 2),
            max_execution_time_ms=round(max_time_ms, 2),
        )


def run_custom_testcases(
    code: str,
    test_cases: List[CustomTestCase],
    timeout_seconds: float = 5.0,
) -> RunCustomTestCasesResponse:
    """
    Compile C code once and execute against a user-provided list of custom test cases.
    Returns detailed results for each individual test case.
    """
    effective_timeout = max(0.1, min(timeout_seconds, 15.0))
    total_cases = len(test_cases)

    with tempfile.TemporaryDirectory(prefix="c_custom_test_") as temp_dir:
        temp_path = Path(temp_dir)
        source_file = temp_path / "solution.c"
        executable_file = temp_path / "solution.exe"

        # 1. Write source code
        try:
            source_file.write_text(code, encoding="utf-8")
        except Exception as e:
            return RunCustomTestCasesResponse(
                status="internal_error",
                total_test_cases=total_cases,
                passed_test_cases=0,
                compilation_output=f"Failed to write source code: {str(e)}",
            )

        # 2. Compile ONCE
        is_compiled, compilation_output, compile_code = compile_source_file(
            source_file=source_file,
            executable_file=executable_file,
            temp_dir=temp_dir,
        )

        if not is_compiled:
            return RunCustomTestCasesResponse(
                status="compilation_error",
                total_test_cases=total_cases,
                passed_test_cases=0,
                compilation_output=compilation_output,
            )

        # 3. Execute all custom test cases
        results: List[TestCaseExecutionResult] = []
        passed_count = 0
        total_time_ms = 0.0

        for idx, tc in enumerate(test_cases, start=1):
            exit_code, stdout, stderr, elapsed_ms, is_timeout = execute_binary(
                executable_file=executable_file,
                temp_dir=temp_dir,
                stdin_data=tc.input,
                timeout=effective_timeout,
            )

            total_time_ms += elapsed_ms

            if is_timeout:
                results.append(
                    TestCaseExecutionResult(
                        test_case_number=idx,
                        input=tc.input,
                        expected_output=tc.expected_output,
                        actual_output="",
                        passed=False,
                        status="time_limit_exceeded",
                        exit_code=None,
                        stderr=f"Time limit exceeded ({effective_timeout:.2f}s).",
                        execution_time_ms=elapsed_ms,
                    )
                )
                continue

            if exit_code != 0:
                results.append(
                    TestCaseExecutionResult(
                        test_case_number=idx,
                        input=tc.input,
                        expected_output=tc.expected_output,
                        actual_output=stdout,
                        passed=False,
                        status="runtime_error",
                        exit_code=exit_code,
                        stderr=stderr or f"Process exited with non-zero code {exit_code}.",
                        execution_time_ms=elapsed_ms,
                    )
                )
                continue

            # Compare if expected output was provided
            if tc.expected_output is not None:
                actual_norm = normalize_output(stdout)
                expected_norm = normalize_output(tc.expected_output)
                is_passed = (actual_norm == expected_norm)
                if is_passed:
                    passed_count += 1
                case_status = "success" if is_passed else "wrong_answer"
            else:
                is_passed = True
                passed_count += 1
                case_status = "success"

            results.append(
                TestCaseExecutionResult(
                    test_case_number=idx,
                    input=tc.input,
                    expected_output=tc.expected_output,
                    actual_output=stdout,
                    passed=is_passed,
                    status=case_status,
                    exit_code=exit_code,
                    stderr=stderr,
                    execution_time_ms=elapsed_ms,
                )
            )

        overall_status = "success" if passed_count == total_cases else "wrong_answer"
        if any(r.status == "time_limit_exceeded" for r in results) and passed_count == 0:
            overall_status = "time_limit_exceeded"
        elif any(r.status == "runtime_error" for r in results) and passed_count == 0:
            overall_status = "runtime_error"

        return RunCustomTestCasesResponse(
            status=overall_status,
            total_test_cases=total_cases,
            passed_test_cases=passed_count,
            compilation_output=compilation_output,
            results=results,
            total_execution_time_ms=round(total_time_ms, 2),
        )
