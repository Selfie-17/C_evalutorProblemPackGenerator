import tempfile
from pathlib import Path
from typing import List, Optional

from app.models import (
    CompilationDiagnostic,
    CompilationResult,
    CustomTestCase,
    ExecutionSummary,
    JudgeStatus,
    JudgeVerdict,
    RunCustomTestCasesResponse,
    StandardizedJudgeResult,
    SubmitCodeResponse,
    TestCaseExecutionDetail,
    TestCaseExecutionResult,
    TestCaseSummary,
)
from app.problems import TestCase, get_problem
from app.services.compiler import compile_c_source, compile_source_file, execute_binary


def normalize_output(text: str) -> str:
    """Normalize output by stripping trailing whitespace and normalizing newline characters."""
    if text is None:
        return ""
    lines = [line.rstrip() for line in text.strip().splitlines()]
    return "\n".join(lines)


def evaluate_c_submission(
    code: str,
    test_cases: List[TestCase],
    time_limit: float = 2.0,
    stop_on_first_fail: bool = False,
    hide_private_cases: bool = False,
) -> StandardizedJudgeResult:
    """
    Standardized C submission evaluator:
    1. Compiles C source once using MSYS64 GCC.
    2. Parses structured compiler diagnostics (line, column, severity, message) and captures raw output.
    3. If compilation fails, returns COMPILATION_ERROR verdict immediately.
    4. Executes binary sequentially against all test cases.
    5. Computes exact passed/failed test cases, total/max execution times, and per-testcase details.
    """
    total_cases = len(test_cases)
    effective_timeout = max(0.1, min(time_limit, 15.0))

    with tempfile.TemporaryDirectory(prefix="c_eval_") as temp_dir:
        temp_path = Path(temp_dir)
        source_file = temp_path / "solution.c"
        executable_file = temp_path / "solution.exe"

        # 1. Write source code
        try:
            source_file.write_text(code, encoding="utf-8")
        except Exception as e:
            return StandardizedJudgeResult(
                verdict=JudgeVerdict.INTERNAL_ERROR,
                test_cases=TestCaseSummary(total=total_cases, passed=0, failed=total_cases),
                compilation=CompilationResult(
                    success=False,
                    stderr=f"Failed to write source code: {str(e)}",
                    compiler_output=f"Failed to write source code: {str(e)}",
                    errors=[CompilationDiagnostic(message=str(e), severity="error")],
                ),
            )

        # 2. Compile ONCE
        comp_res = compile_c_source(
            source_file=source_file,
            executable_file=executable_file,
            temp_dir=temp_dir,
            source_code=code,
        )

        if not comp_res.success:
            return StandardizedJudgeResult(
                verdict=JudgeVerdict.COMPILATION_ERROR,
                test_cases=TestCaseSummary(total=total_cases, passed=0, failed=total_cases),
                execution=ExecutionSummary(total_time_ms=0.0, max_time_ms=0.0),
                compilation=comp_res,
                failed_test_case=None,
                details=[],
            )

        # 3. Execute test cases
        passed_count = 0
        total_time_ms = 0.0
        max_time_ms = 0.0
        details: List[TestCaseExecutionDetail] = []
        first_failed_idx: Optional[int] = None
        first_failed_status: Optional[str] = None

        for idx, tc in enumerate(test_cases, start=1):
            exit_code, stdout, stderr, elapsed_ms, is_timeout = execute_binary(
                executable_file=executable_file,
                temp_dir=temp_dir,
                stdin_data=tc.input,
                timeout=effective_timeout,
            )

            total_time_ms += elapsed_ms
            max_time_ms = max(max_time_ms, elapsed_ms)

            # Determine test case verdict
            is_hidden = getattr(tc, "is_hidden", False)
            should_mask = is_hidden and hide_private_cases

            display_input = None if should_mask else tc.input
            display_expected = None if should_mask else tc.expected_output
            display_actual = None if should_mask else stdout

            if is_timeout:
                status_str = "time_limit_exceeded"
                is_passed = False
            elif exit_code != 0:
                status_str = "runtime_error"
                is_passed = False
            else:
                actual_norm = normalize_output(stdout)
                expected_norm = normalize_output(tc.expected_output)
                is_passed = (actual_norm == expected_norm)
                status_str = "accepted" if is_passed else "wrong_answer"

            if is_passed:
                passed_count += 1
            else:
                if first_failed_idx is None:
                    first_failed_idx = idx
                    first_failed_status = status_str

            details.append(
                TestCaseExecutionDetail(
                    test_case_number=idx,
                    is_hidden=is_hidden,
                    input=display_input,
                    expected_output=display_expected,
                    actual_output=display_actual,
                    passed=is_passed,
                    status=status_str,
                    exit_code=exit_code,
                    stderr=stderr if not should_mask else "",
                    execution_time_ms=elapsed_ms,
                )
            )

            if stop_on_first_fail and not is_passed:
                break

        # Compute overall verdict
        if passed_count == total_cases:
            verdict = JudgeVerdict.ACCEPTED
        elif first_failed_status == "time_limit_exceeded" and passed_count == 0:
            verdict = JudgeVerdict.TIME_LIMIT_EXCEEDED
        elif first_failed_status == "runtime_error" and passed_count == 0:
            verdict = JudgeVerdict.RUNTIME_ERROR
        else:
            verdict = JudgeVerdict.WRONG_ANSWER

        return StandardizedJudgeResult(
            verdict=verdict,
            test_cases=TestCaseSummary(
                total=total_cases,
                passed=passed_count,
                failed=total_cases - passed_count,
            ),
            execution=ExecutionSummary(
                total_time_ms=round(total_time_ms, 2),
                max_time_ms=round(max_time_ms, 2),
            ),
            compilation=comp_res,
            failed_test_case=first_failed_idx,
            details=details,
        )


def judge_solution(
    problem_id: str,
    code: str,
    custom_timeout: Optional[float] = None,
) -> SubmitCodeResponse:
    """
    Judge a submitted C solution against problem test cases:
    1. Look up problem by ID.
    2. Enforce server-controlled problem timeout limit.
    3. Run evaluate_c_submission.
    4. Return backward-compatible SubmitCodeResponse with structured diagnostics.
    """
    problem = get_problem(problem_id)
    if not problem:
        return SubmitCodeResponse(
            status=JudgeStatus.INTERNAL_ERROR,
            problem_id=problem_id,
            stderr=f"Problem '{problem_id}' not found.",
        )

    effective_timeout = problem.time_limit
    if custom_timeout is not None:
        effective_timeout = max(0.1, min(custom_timeout, problem.time_limit))

    all_cases = problem.all_test_cases
    result = evaluate_c_submission(
        code=code,
        test_cases=all_cases,
        time_limit=effective_timeout,
        stop_on_first_fail=True,
        hide_private_cases=True,
    )

    # Map standardized verdict to JudgeStatus
    status_map = {
        JudgeVerdict.ACCEPTED: JudgeStatus.ACCEPTED,
        JudgeVerdict.WRONG_ANSWER: JudgeStatus.WRONG_ANSWER,
        JudgeVerdict.COMPILATION_ERROR: JudgeStatus.COMPILATION_ERROR,
        JudgeVerdict.RUNTIME_ERROR: JudgeStatus.RUNTIME_ERROR,
        JudgeVerdict.TIME_LIMIT_EXCEEDED: JudgeStatus.TIME_LIMIT_EXCEEDED,
        JudgeVerdict.INTERNAL_ERROR: JudgeStatus.INTERNAL_ERROR,
    }
    judge_status = status_map.get(result.verdict, JudgeStatus.INTERNAL_ERROR)

    failed_detail = None
    if result.failed_test_case and result.details:
        for d in result.details:
            if d.test_case_number == result.failed_test_case:
                failed_detail = d
                break

    return SubmitCodeResponse(
        status=judge_status,
        problem_id=problem_id,
        total_test_cases=result.test_cases.total,
        passed_test_cases=result.test_cases.passed,
        failed_test_case=result.failed_test_case,
        input=failed_detail.input if failed_detail else None,
        expected_output=failed_detail.expected_output if failed_detail else None,
        actual_output=failed_detail.actual_output if failed_detail else None,
        compilation_output=result.compilation.compiler_output,
        compilation_diagnostics=result.compilation.errors,
        stderr=failed_detail.stderr if failed_detail else result.compilation.stderr,
        total_execution_time_ms=result.execution.total_time_ms,
        max_execution_time_ms=result.execution.max_time_ms,
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
