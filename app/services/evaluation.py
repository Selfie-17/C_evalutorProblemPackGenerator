import asyncio
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional

from app.database.db import (
    create_evaluation_job,
    get_evaluation_job,
    get_week,
    get_week_problems,
    register_student,
    save_submission,
    update_job_progress,
    update_week,
)
from app.models import (
    CompilationDiagnostic,
    CompilationResult,
    JudgeVerdict,
    ProblemInPack,
    StandardizedJudgeResult,
)
from app.problems import TestCase
from app.services.judge import evaluate_c_submission
from app.services.zip_processor import cleanup_staging, get_staged_student_files

logger = logging.getLogger(__name__)

# Configurable concurrency: defaults to 3 workers to prevent CPU overload & keep system responsive
MAX_EVALUATION_WORKERS: int = int(os.getenv("MAX_EVALUATION_WORKERS", "3"))
_thread_pool = ThreadPoolExecutor(max_workers=MAX_EVALUATION_WORKERS)


def _evaluate_single_program_sync(
    code: str,
    test_cases: List[TestCase],
    time_limit: float = 2.0,
) -> StandardizedJudgeResult:
    """Synchronous worker function to compile and evaluate a single student C program."""
    return evaluate_c_submission(
        code=code,
        test_cases=test_cases,
        time_limit=time_limit,
        stop_on_first_fail=False,  # Run all test cases for comprehensive lab grading (e.g. 7/10 passed)
        hide_private_cases=False,  # Instructor evaluation records full data in database
    )


async def run_batch_evaluation(
    job_id: str,
    week_id: str,
    staging_token: str,
    continue_on_error: bool = True,
    section: str = "Section A",
) -> None:
    """
    Background batch evaluation runner:
    1. Loads staged student files and week problems (P1..P10).
    2. Controls evaluation concurrency via semaphore.
    3. Evaluates all C programs and saves verdicts and compilation diagnostics to SQLite.
    4. Updates real-time job progress with section tagging.
    """
    loop = asyncio.get_running_loop()
    semaphore = asyncio.Semaphore(MAX_EVALUATION_WORKERS)

    try:
        week = get_week(week_id)
        if not week:
            update_job_progress(job_id, status="failed", error_message=f"Week '{week_id}' not found.")
            return

        problems_in_pack = get_week_problems(week_id)
        if not problems_in_pack:
            update_job_progress(job_id, status="failed", error_message=f"No problems found in week '{week_id}'.")
            return

        # Map problem number -> ProblemInPack
        prob_by_num: Dict[int, ProblemInPack] = {p.number: p for p in problems_in_pack}

        student_files_map = get_staged_student_files(staging_token)
        student_ids = sorted(student_files_map.keys())

        total_students = len(student_ids)
        total_submissions = total_students * len(problems_in_pack)

        update_job_progress(
            job_id,
            status="running",
            processed_students=0,
            processed_submissions=0,
            current_student="Starting evaluation...",
        )
        update_week(week_id, status="evaluating")

        processed_subs = 0
        processed_stus = 0

        for sid in student_ids:
            # Register student in week roster with section
            register_student(week_id=week_id, student_id=sid, section=section)
            update_job_progress(job_id, current_student=sid)

            student_programs = student_files_map[sid]

            for pnum in range(1, len(problems_in_pack) + 1):
                prob = prob_by_num.get(pnum)
                if not prob:
                    continue

                sub_id = f"sub_{week_id}_{sid}_p{pnum}"
                c_file_path: Optional[Path] = student_programs.get(pnum)

                if c_file_path is None or not c_file_path.is_file():
                    # Student did not submit this problem
                    comp_missing = CompilationResult(
                        success=False,
                        exit_code=-1,
                        stdout="",
                        stderr="Program not submitted.",
                        compiler_output="Program not submitted.",
                        errors=[CompilationDiagnostic(message="Program file not submitted.", severity="note")],
                    )
                    save_submission(
                        submission_id=sub_id,
                        job_id=job_id,
                        week_id=week_id,
                        student_id=sid,
                        problem_id=prob.id,
                        problem_number=pnum,
                        source_file=f"p{pnum}.c",
                        source_code="",
                        verdict=JudgeVerdict.NOT_SUBMITTED.value,
                        passed_test_cases=0,
                        total_test_cases=len(prob.public_test_cases) + len(prob.hidden_test_cases),
                        failed_test_case_number=None,
                        total_time_ms=0.0,
                        max_time_ms=0.0,
                        compilation_res=comp_missing,
                        test_results=[],
                        section=section,
                    )
                    processed_subs += 1
                    update_job_progress(job_id, processed_submissions=processed_subs)
                    continue

                # Read student C code
                try:
                    code_content = c_file_path.read_text(encoding="utf-8", errors="replace")
                except Exception as e:
                    code_content = ""
                    logger.error(f"Error reading file {c_file_path}: {e}")

                # Build test cases list
                all_cases = [
                    TestCase(input=tc.input, expected_output=tc.expected_output, is_hidden=False)
                    for tc in prob.public_test_cases
                ] + [
                    TestCase(input=tc.input, expected_output=tc.expected_output, is_hidden=True)
                    for tc in prob.hidden_test_cases
                ]

                # Run evaluation inside worker semaphore
                async with semaphore:
                    try:
                        judge_result: StandardizedJudgeResult = await loop.run_in_executor(
                            _thread_pool,
                            _evaluate_single_program_sync,
                            code_content,
                            all_cases,
                            prob.time_limit,
                        )
                    except Exception as e:
                        logger.error(f"Evaluation failed for {sid} P{pnum}: {e}")
                        if not continue_on_error:
                            raise
                        judge_result = StandardizedJudgeResult(
                            verdict=JudgeVerdict.INTERNAL_ERROR,
                            compilation=CompilationResult(
                                success=False,
                                stderr=f"Internal evaluation error: {str(e)}",
                                compiler_output=str(e),
                                errors=[CompilationDiagnostic(message=str(e), severity="error")],
                            ),
                        )

                # Persist submission result to SQLite
                save_submission(
                    submission_id=sub_id,
                    job_id=job_id,
                    week_id=week_id,
                    student_id=sid,
                    problem_id=prob.id,
                    problem_number=pnum,
                    source_file=c_file_path.name,
                    source_code=code_content,
                    verdict=judge_result.verdict.value,
                    passed_test_cases=judge_result.test_cases.passed,
                    total_test_cases=judge_result.test_cases.total,
                    failed_test_case_number=judge_result.failed_test_case,
                    total_time_ms=judge_result.execution.total_time_ms,
                    max_time_ms=judge_result.execution.max_time_ms,
                    compilation_res=judge_result.compilation,
                    test_results=judge_result.details,
                    section=section,
                )

                processed_subs += 1
                update_job_progress(job_id, processed_submissions=processed_subs)

            processed_stus += 1
            update_job_progress(job_id, processed_students=processed_stus)

        # Mark job completed
        update_job_progress(
            job_id,
            status="completed",
            current_student="Evaluation complete.",
        )
        update_week(week_id, status="evaluated")
        cleanup_staging(staging_token)

    except Exception as e:
        logger.exception(f"Fatal error in evaluation job {job_id}: {e}")
        update_job_progress(job_id, status="failed", error_message=str(e))
        update_week(week_id, status="ready")


def start_evaluation_job(
    week_id: str,
    staging_token: str,
    continue_on_error: bool = True,
    section: str = "Section A",
) -> str:
    """Initialize evaluation job record and launch background evaluation task with section tagging."""
    staged_files = get_staged_student_files(staging_token)
    problems = get_week_problems(week_id)

    total_students = len(staged_files)
    total_submissions = total_students * len(problems)
    job_id = f"eval_{uuid.uuid4().hex[:12]}"
    sec = section.strip() if section and section.strip() else "Section A"

    create_evaluation_job(
        job_id=job_id,
        week_id=week_id,
        total_students=total_students,
        total_submissions=total_submissions,
        continue_on_error=continue_on_error,
        section=sec,
    )

    # Launch in background (supports both FastAPI event loop and sync threads)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            run_batch_evaluation(
                job_id=job_id,
                week_id=week_id,
                staging_token=staging_token,
                continue_on_error=continue_on_error,
                section=sec,
            )
        )
    except RuntimeError:
        import threading
        threading.Thread(
            target=lambda: asyncio.run(
                run_batch_evaluation(
                    job_id=job_id,
                    week_id=week_id,
                    staging_token=staging_token,
                    continue_on_error=continue_on_error,
                    section=sec,
                )
            ),
            daemon=True,
        ).start()

    return job_id
