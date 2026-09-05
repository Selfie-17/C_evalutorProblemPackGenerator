from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.database.db import (
    get_student_submission,
    get_week,
    list_week_student_summaries,
)
from app.models import (
    StudentDetailResponse,
    StudentSubmissionDetail,
    StudentSummaryItem,
)
from app.services.analytics import compute_student_detail

router = APIRouter(prefix="/api/weeks/{week_id}/students", tags=["Students & Submissions"])


@router.get("", response_model=List[StudentSummaryItem])
def get_students(week_id: str, section: Optional[str] = Query(None)):
    """Retrieve all students and their performance summaries in a week (optionally filtered by section)."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    return list_week_student_summaries(week_id, section=section)


@router.get("/{student_id}", response_model=StudentDetailResponse)
def get_student_detail(week_id: str, student_id: str):
    """Retrieve detailed overview of a single student, including problem results."""
    try:
        return compute_student_detail(week_id=week_id, student_id=student_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{student_id}/submissions/{problem_number}", response_model=StudentSubmissionDetail)
def get_submission_detail(week_id: str, student_id: str, problem_number: int):
    """Retrieve full submission code, line-by-line compiler diagnostics, and test case outcomes."""
    submission = get_student_submission(
        week_id=week_id,
        student_id=student_id,
        problem_number_or_id=problem_number,
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission for student '{student_id}' problem {problem_number} not found.",
        )
    return submission
