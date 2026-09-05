import io
import json
import zipfile
from typing import Any, Dict

from app.database.db import (
    get_student_submissions,
    get_student_summary,
    get_week,
    get_week_problems,
    get_week_students,
)
from app.models import JudgeVerdict
from app.services.analytics import compute_week_analytics


def generate_student_export_dict(week_id: str, student_id: str) -> Dict[str, Any]:
    """Generate structured dictionary for single student export matching prompt specification."""
    week = get_week(week_id)
    if not week:
        raise ValueError(f"Week '{week_id}' not found.")

    summary = get_student_summary(week_id, student_id)
    submissions = get_student_submissions(week_id, student_id)

    problems_data = []
    for s in submissions:
        problems_data.append(
            {
                "problem_number": s.problem_number,
                "problem_id": s.problem_id,
                "problem_title": s.problem_title,
                "verdict": s.verdict.value,
                "passed_test_cases": s.passed_test_cases,
                "total_test_cases": s.total_test_cases,
                "execution_time_ms": s.total_time_ms,
                "source_file": s.source_file,
                "source_code": s.source_code,
                "compilation": {
                    "success": s.compilation.success,
                    "exit_code": s.compilation.exit_code,
                    "stdout": s.compilation.stdout,
                    "stderr": s.compilation.stderr,
                    "compiler_output": s.compilation.compiler_output,
                    "diagnostics": [d.model_dump() for d in s.compilation.errors],
                },
                "test_case_results": [t.model_dump() for t in s.test_results],
                "submitted_at": s.submitted_at,
            }
        )

    return {
        "student_id": student_id,
        "week": week.week_number,
        "week_id": week.id,
        "week_title": week.title,
        "summary": {
            "total_problems": summary.total_problems,
            "accepted": summary.solved_count,
            "wrong_answer": summary.wrong_answers,
            "compilation_error": summary.compilation_errors,
            "runtime_error": summary.runtime_errors,
            "tle": summary.tle_count,
            "not_submitted": summary.not_submitted,
            "score_percentage": summary.acceptance_rate,
            "average_time_ms": summary.average_time_ms,
        },
        "problems": problems_data,
    }


def generate_consolidated_week_json(week_id: str, section: Optional[str] = None) -> str:
    """Generate single consolidated JSON string for week results (optionally section-filtered)."""
    week = get_week(week_id)
    if not week:
        raise ValueError(f"Week '{week_id}' not found.")

    analytics = compute_week_analytics(week_id, section=section)
    students = get_week_students(week_id, section=section)
    problems = get_week_problems(week_id)

    students_data = [generate_student_export_dict(week_id, sid) for sid in students]

    consolidated = {
        "week": {
            "id": week.id,
            "week_number": week.week_number,
            "title": week.title,
            "description": week.description,
            "status": week.status,
            "created_at": week.created_at,
            "section": section,
        },
        "analytics": analytics.model_dump(),
        "problems": [p.model_dump() for p in problems],
        "students": students_data,
    }

    return json.dumps(consolidated, indent=2)


def generate_week_results_zip(week_id: str, section: Optional[str] = None) -> bytes:
    """
    Generate ZIP archive for week results containing:
      week_01_results/
      ├── week_summary.json
      ├── students/
      │   ├── 22001.json
      │   └── ...
      └── problems/
          ├── p1.json
          └── ...
    """
    week = get_week(week_id)
    if not week:
        raise ValueError(f"Week '{week_id}' not found.")

    analytics = compute_week_analytics(week_id, section=section)
    students = get_week_students(week_id, section=section)
    problems = get_week_problems(week_id)

    buffer = io.BytesIO()
    sec_suffix = f"_{section.replace(' ', '_')}" if section and section.lower() not in ("all", "all sections", "") else ""
    prefix = f"week_{week.week_number:02d}{sec_suffix}_results"

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. week_summary.json
        summary_obj = {
            "week": week.model_dump(),
            "section": section,
            "analytics": analytics.model_dump(),
        }
        zf.writestr(
            f"{prefix}/week_summary.json",
            json.dumps(summary_obj, indent=2),
        )

        # 2. students/<student_id>.json
        for sid in students:
            stu_data = generate_student_export_dict(week_id, sid)
            zf.writestr(
                f"{prefix}/students/{sid}.json",
                json.dumps(stu_data, indent=2),
            )

        # 3. problems/p<number>.json
        for prob in problems:
            zf.writestr(
                f"{prefix}/problems/p{prob.number}.json",
                json.dumps(prob.model_dump(), indent=2),
            )

    buffer.seek(0)
    return buffer.getvalue()


def generate_problem_pack_zip(week_id: str) -> bytes:
    """
    Generate ZIP archive for the problem pack:
      Week_01_Problems.zip
      ├── P1.json
      ├── ...
      ├── P10.json
      └── problem_pack.json
    """
    week = get_week(week_id)
    if not week:
        raise ValueError(f"Week '{week_id}' not found.")

    problems = get_week_problems(week_id)
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for prob in problems:
            zf.writestr(
                f"P{prob.number}.json",
                json.dumps(prob.model_dump(), indent=2),
            )

        master_pack = {
            "week": week.week_number,
            "week_title": week.title,
            "description": week.description,
            "total_problems": len(problems),
            "problems": [p.model_dump() for p in problems],
        }
        zf.writestr("problem_pack.json", json.dumps(master_pack, indent=2))

    buffer.seek(0)
    return buffer.getvalue()
