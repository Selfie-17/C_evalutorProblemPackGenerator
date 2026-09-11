"""
Problem Engine FastAPI Router.
Provides REST endpoints for Problem Pack management, canonical import/export,
AI test case generation (Qwen & Gemini), deterministic validation,
Gemini review, and interactive LeetCode C compilation and execution.
"""

import json
import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.config import GEMINI_API_KEY, VIVA_GEMINI_MODEL
from app.services.compiler import (
    compile_and_run_c,
    compile_source_file,
    execute_binary,
    get_executable_extension,
)
from app.services.judge import normalize_output, run_custom_testcases
from app.database.db import get_problem_by_id, save_problem
from app.models import CustomTestCase, TestCaseSchema
from problem_engine.gemini_reviewer import review_problem_with_gemini
from problem_engine.json_io import (
    build_sample_problem_pack,
    build_sample_single_problem,
    export_problem_pack_json,
    import_problem_pack_json,
)
from problem_engine.problem_pack_manager import ProblemPackManager
from problem_engine.problem_schema import Problem, ProblemPack, TestCase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/problem-engine", tags=["Problem Engine"])


# ==============================================================================
# Request & Response Models
# ==============================================================================

class ParseTextRequest(BaseModel):
    raw_text: str = Field(..., description="Raw text containing problem statements")
    pack_id: Optional[str] = Field(default="week-01", description="Pack identifier")
    title: Optional[str] = Field(default="C Laboratory Problem Pack", description="Pack title")


class ValidateJsonRequest(BaseModel):
    raw_content: Any = Field(..., description="Raw JSON string or dictionary object")


class GenerateProblemRequest(BaseModel):
    problem: Problem = Field(..., description="Problem definition")
    provider: str = Field(default="qwen", description="'qwen' or 'gemini'")
    target_count: int = Field(default=50, ge=1, le=100, description="Target number of test cases")
    gemini_api_key: Optional[str] = Field(default=None, description="Optional Gemini API key")


class GeneratePackRequest(BaseModel):
    pack: ProblemPack = Field(..., description="Problem pack definition")
    provider: str = Field(default="qwen", description="'qwen' or 'gemini'")
    target_count: int = Field(default=50, ge=1, le=100, description="Target number of test cases per problem")
    gemini_api_key: Optional[str] = Field(default=None, description="Optional Gemini API key")


class GeminiReviewRequest(BaseModel):
    problem: Problem = Field(..., description="Problem to review")
    gemini_api_key: Optional[str] = Field(default=None, description="Optional Gemini API key")


class DeployPackRequest(BaseModel):
    pack: ProblemPack = Field(..., description="Problem pack to deploy")
    replace_all: bool = Field(default=False, description="Whether to replace existing problems in the week")


class LeetCodeRunTestCaseItem(BaseModel):
    test_id: Optional[str] = None
    input: str
    expected_output: Optional[str] = None


class LeetCodeRunCodeRequest(BaseModel):
    code: str = Field(..., description="C source code to execute")
    test_cases: List[LeetCodeRunTestCaseItem] = Field(
        default_factory=list,
        description="List of test cases to execute against"
    )
    custom_stdin: Optional[str] = Field(
        default=None,
        description="Single custom input if not running test cases"
    )
    timeout: Optional[float] = Field(default=3.0, description="Per-case timeout in seconds")


# ==============================================================================
# Endpoints
# ==============================================================================

@router.get("/gemini-status", summary="Check Gemini API configuration status")
def get_gemini_status() -> Dict[str, Any]:
    """Return whether GEMINI_API_KEY is configured on the backend."""
    has_key = bool(GEMINI_API_KEY and GEMINI_API_KEY.strip())
    return {
        "configured": has_key,
        "model": VIVA_GEMINI_MODEL or "gemini-2.5-flash",
    }


@router.get("/sample-json", summary="Get canonical sample ProblemPack JSON")
def get_sample_json() -> Dict[str, Any]:
    """Retrieve canonical sample problem pack (v1.0)."""
    sample = build_sample_problem_pack()
    return sample.model_dump()


@router.get("/sample-problem-json", summary="Get canonical sample single Problem JSON")
def get_sample_problem_json() -> Dict[str, Any]:
    """Retrieve canonical sample single problem (v1.0)."""
    sample = build_sample_single_problem()
    return sample.model_dump()



@router.post("/parse", summary="Parse raw multiline problem statements")
def parse_problems(request: ParseTextRequest) -> Dict[str, Any]:
    """Parse arbitrary raw problem text into structured Problem objects."""
    pack = ProblemPackManager.parse_raw_text(
        raw_text=request.raw_text,
        pack_id=request.pack_id or "week-01",
        title=request.title or "C Laboratory Problem Pack",
    )
    return {"pack": pack.model_dump()}


@router.post("/classify", summary="Classify problems in a problem pack")
async def classify_pack_endpoint(pack: ProblemPack) -> Dict[str, Any]:
    """Run Qwen/heuristic classification on problems."""
    updated = await ProblemPackManager.classify_pack(pack)
    return {"pack": updated.model_dump()}


@router.post("/validate-json", summary="Validate uploaded JSON against Canonical Schema v1.0")
def validate_json_endpoint(request: ValidateJsonRequest) -> Dict[str, Any]:
    """Strictly validate uploaded JSON against canonical schema."""
    try:
        pack = ProblemPackManager.import_json(request.raw_content)
        return {
            "valid": True,
            "error": None,
            "pack": pack.model_dump(),
        }
    except ValueError as e:
        return {
            "valid": False,
            "error": str(e),
            "pack": None,
        }


@router.post("/generate-problem", summary="Generate test cases for a single problem")
async def generate_single_problem_endpoint(request: GenerateProblemRequest) -> Dict[str, Any]:
    """Generate test cases for one problem using Qwen or Gemini."""
    problem = await ProblemPackManager.generate_tests_for_problem(
        problem=request.problem,
        provider=request.provider,
        target_count=request.target_count,
        gemini_api_key=request.gemini_api_key,
    )
    return {"problem": problem.model_dump()}


@router.post("/generate-pack", summary="Generate test cases for all problems in pack")
async def generate_pack_endpoint(request: GeneratePackRequest) -> Dict[str, Any]:
    """Generate test cases sequentially for all problems in pack."""
    pack = await ProblemPackManager.generate_tests_for_pack(
        pack=request.pack,
        provider=request.provider,
        target_count=request.target_count,
        gemini_api_key=request.gemini_api_key,
    )
    return {"pack": pack.model_dump()}


@router.post("/validate-test-cases", summary="Run deterministic Python validation")
def validate_test_cases_endpoint(problem: Problem) -> Dict[str, Any]:
    """Run Python deterministic validation over test cases."""
    updated = ProblemPackManager.validate_problem_cases(problem)
    return {"problem": updated.model_dump()}


@router.post("/gemini-review", summary="Review problem test cases with Gemini Flash")
async def gemini_review_endpoint(request: GeminiReviewRequest) -> Dict[str, Any]:
    """Review problem test cases with Gemini Flash."""
    review = await review_problem_with_gemini(
        problem=request.problem,
        api_key=request.gemini_api_key,
    )
    return {"review": review}


@router.post("/deploy-to-week/{week_id}", summary="Deploy problem pack to a laboratory week")
def deploy_to_week_endpoint(week_id: str, request: DeployPackRequest) -> Dict[str, Any]:
    """Commit ProblemPack problems to SQLite for student evaluation."""
    try:
        result = ProblemPackManager.deploy_to_laboratory_week(
            request.pack, week_id, replace_all=request.replace_all
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Deploy error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deployment failed: {str(e)}",
        )


# ==============================================================================
# LeetCode C Code Execution Endpoint
# ==============================================================================

@router.post("/run-code", summary="Execute C code in LeetCode-style environment")
def leetcode_run_code(request: LeetCodeRunCodeRequest) -> Dict[str, Any]:
    """
    Compile C code once and execute either against:
    - Custom stdin (single run), or
    - Array of test cases (batch run up to 50+ cases)
    Returns structured results, diagnostics, diffs, and execution times.
    """
    # 1. Single custom execution if no test cases provided
    if not request.test_cases:
        res = compile_and_run_c(
            code=request.code,
            stdin_input=request.custom_stdin or "",
            timeout_seconds=request.timeout or 3.0,
        )
        return {
            "mode": "single",
            "status": res.status.value,
            "stdout": res.stdout,
            "stderr": res.stderr,
            "compilation_output": res.compilation_output,
            "diagnostics": [d.model_dump() for d in res.diagnostics],
            "exit_code": res.exit_code,
            "execution_time_ms": res.execution_time_ms,
        }

    # 2. Batch execution against test cases
    custom_cases = [
        CustomTestCase(
            input=tc.input,
            expected_output=tc.expected_output,
        )
        for tc in request.test_cases
    ]

    batch_res = run_custom_testcases(
        code=request.code,
        test_cases=custom_cases,
        timeout_seconds=request.timeout or 3.0,
    )

    # Attach original test_id if available
    detailed_results = []
    for idx, item in enumerate(batch_res.results):
        t_item = item.model_dump()
        if idx < len(request.test_cases):
            t_item["test_id"] = request.test_cases[idx].test_id
        detailed_results.append(t_item)

    verdict_map = {
        "success": "Accepted",
        "wrong_answer": "Wrong Answer",
        "compilation_error": "Compilation Error",
        "runtime_error": "Runtime Error",
        "time_limit_exceeded": "Time Limit Exceeded",
        "internal_error": "Internal Error",
    }
    verdict = verdict_map.get(batch_res.status, batch_res.status)

    return {
        "mode": "batch",
        "verdict": verdict,
        "status": batch_res.status,
        "total_test_cases": batch_res.total_test_cases,
        "passed_test_cases": batch_res.passed_test_cases,
        "compilation_output": batch_res.compilation_output,
        "total_execution_time_ms": batch_res.total_execution_time_ms,
        "results": detailed_results,
    }


# ==============================================================================
# Test Case Verification & Auto-Calibration Endpoints
# ==============================================================================

class VerifyProblemTestCasesRequest(BaseModel):
    problem_id: Optional[str] = Field(default=None, description="Problem ID (e.g. week-01-p2)")
    code: Optional[str] = Field(default=None, description="Optional custom C code to verify against")
    test_cases: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional test cases")


class CalibrateProblemTestCasesRequest(BaseModel):
    problem_id: Optional[str] = Field(default=None, description="Problem ID (e.g. week-01-p2)")
    code: Optional[str] = Field(default=None, description="Optional custom C code to calibrate with")
    test_cases: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional test cases")


@router.post("/verify-problem-testcases", summary="Verify whether problem test cases are valid against reference solution")
def verify_problem_testcases(request: VerifyProblemTestCasesRequest) -> Dict[str, Any]:
    problem = None
    if request.problem_id:
        problem = get_problem_by_id(request.problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{request.problem_id}' not found.")

    code = request.code or (problem.reference_solution_c if problem else "")
    if not code:
        raise HTTPException(status_code=400, detail="No C reference solution provided or found for problem.")

    test_cases = request.test_cases
    if not test_cases and problem:
        test_cases = [tc.model_dump() for tc in (problem.public_test_cases + problem.hidden_test_cases)]

    if not test_cases:
        return {
            "status": "no_test_cases",
            "is_valid": True,
            "total_cases": 0,
            "passed_cases": 0,
            "failed_cases": 0,
            "discrepancies": [],
        }

    with tempfile.TemporaryDirectory(prefix="c_verify_tc_") as temp_dir:
        src_path = Path(temp_dir) / "ref.c"
        exe_path = Path(temp_dir) / f"ref{get_executable_extension()}"
        src_path.write_text(code, encoding="utf-8")

        is_compiled, comp_out, exit_code = compile_source_file(src_path, exe_path, temp_dir)
        if not is_compiled:
            return {
                "status": "compilation_error",
                "is_valid": False,
                "compilation_output": comp_out,
                "total_cases": len(test_cases),
                "passed_cases": 0,
                "failed_cases": len(test_cases),
                "discrepancies": [{"error": f"Compilation failed: {comp_out}"}],
            }

        discrepancies = []
        passed_count = 0

        for idx, tc in enumerate(test_cases, 1):
            inp = tc.get("input", "")
            exp = tc.get("expected_output", "")
            tid = tc.get("id") or tc.get("test_id") or f"Case-{idx}"

            _, stdout, stderr, ms, is_timeout = execute_binary(exe_path, temp_dir, stdin_data=inp, timeout=3.0)

            if is_timeout:
                discrepancies.append({
                    "test_case_number": idx,
                    "test_id": tid,
                    "status": "time_limit_exceeded",
                    "input": inp,
                    "expected_output": exp,
                    "reference_output": "",
                    "reason": "Execution timed out (> 3.0s)",
                })
                continue

            norm_actual = normalize_output(stdout)
            norm_expected = normalize_output(exp)

            if norm_actual == norm_expected:
                passed_count += 1
            else:
                discrepancies.append({
                    "test_case_number": idx,
                    "test_id": tid,
                    "status": "output_mismatch",
                    "input": inp,
                    "expected_output": exp,
                    "reference_output": stdout,
                    "reason": f"Expected output mismatch. Reference produced: {stdout.strip()}",
                })

        is_valid = (len(discrepancies) == 0)
        return {
            "status": "valid" if is_valid else "has_discrepancies",
            "is_valid": is_valid,
            "total_cases": len(test_cases),
            "passed_cases": passed_count,
            "failed_cases": len(discrepancies),
            "discrepancies": discrepancies,
        }


@router.post("/calibrate-problem-testcases", summary="Auto-calibrate test cases expected outputs with reference solution")
def calibrate_problem_testcases(request: CalibrateProblemTestCasesRequest) -> Dict[str, Any]:
    problem = None
    if request.problem_id:
        problem = get_problem_by_id(request.problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{request.problem_id}' not found.")

    code = request.code or (problem.reference_solution_c if problem else "")
    if not code:
        raise HTTPException(status_code=400, detail="No C reference solution provided or found for problem.")

    pub_cases = [tc.model_dump() for tc in problem.public_test_cases] if problem else []
    hid_cases = [tc.model_dump() for tc in problem.hidden_test_cases] if problem else []

    if request.test_cases:
        pub_cases = request.test_cases
        hid_cases = []

    with tempfile.TemporaryDirectory(prefix="c_calib_tc_") as temp_dir:
        src_path = Path(temp_dir) / "ref.c"
        exe_path = Path(temp_dir) / f"ref{get_executable_extension()}"
        src_path.write_text(code, encoding="utf-8")

        is_compiled, comp_out, _ = compile_source_file(src_path, exe_path, temp_dir)
        if not is_compiled:
            raise HTTPException(status_code=400, detail=f"Reference solution compilation failed: {comp_out}")

        calibrated_count = 0

        def _calibrate_list(c_list):
            nonlocal calibrated_count
            res = []
            for tc in c_list:
                inp = tc.get("input", "")
                exp = tc.get("expected_output", "")
                _, stdout, stderr, ms, is_timeout = execute_binary(exe_path, temp_dir, stdin_data=inp, timeout=3.0)
                if not is_timeout and stdout is not None:
                    if normalize_output(stdout) != normalize_output(exp):
                        calibrated_count += 1
                    tc["expected_output"] = stdout
                    tc["validation_status"] = "passed"
                    tc["validation_notes"] = "Calibrated with C reference solution"
                res.append(tc)
            return res

        updated_pub = _calibrate_list(pub_cases)
        updated_hid = _calibrate_list(hid_cases)

        if problem:
            problem.public_test_cases = [
                TestCaseSchema(input=tc.get("input", ""), expected_output=tc.get("expected_output", ""))
                for tc in updated_pub
            ]
            problem.hidden_test_cases = [
                TestCaseSchema(input=tc.get("input", ""), expected_output=tc.get("expected_output", ""))
                for tc in updated_hid
            ]
            problem.is_verified = True
            save_problem(problem)

        return {
            "status": "success",
            "message": f"Successfully calibrated {calibrated_count} test cases against verified C reference solution.",
            "total_cases": len(updated_pub) + len(updated_hid),
            "calibrated_count": calibrated_count,
            "public_test_cases": updated_pub,
            "hidden_test_cases": updated_hid,
        }

