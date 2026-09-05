from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from app.database.db import get_evaluation_job, get_week
from app.models import (
    EvaluationJobResponse,
    EvaluationJobStartRequest,
    ZipValidationReport,
)
from app.services.evaluation import start_evaluation_job
from app.services.zip_processor import extract_and_validate_zip

router = APIRouter(tags=["Evaluations & ZIP Processor"])


@router.post(
    "/api/weeks/{week_id}/submissions/validate-zip",
    response_model=ZipValidationReport,
    status_code=status.HTTP_200_OK,
)
async def validate_submission_zip(
    week_id: str,
    file: UploadFile = File(...),
    section: Optional[str] = Form(None),
    section_query: Optional[str] = Query(None, alias="section"),
):
    """
    Safely extract and validate student submissions ZIP:
    - Protects against Zip Slip traversal
    - Discovers student directories and P1..P10 C programs
    - Tags submissions to the selected class section (e.g. Section A, Section B)
    - Generates validation breakdown showing missing files before evaluation
    """
    week = get_week(week_id)
    if not week:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Week '{week_id}' not found.",
        )

    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a .zip archive.",
        )

    target_section = section or section_query or "Section A"

    try:
        content = await file.read()
        expected_count = week.problem_count if (week.problem_count and week.problem_count > 0) else 10
        report = extract_and_validate_zip(
            zip_bytes=content,
            zip_filename=file.filename,
            expected_problems_count=expected_count,
            section=target_section,
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ZIP processing error: {str(e)}",
        )


@router.post(
    "/api/evaluations/start",
    response_model=EvaluationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_evaluation(request: EvaluationJobStartRequest):
    """
    Start batch C evaluation for a validated staging token with class section tagging.
    Runs asynchronously with controlled worker concurrency.
    """
    week = get_week(request.week_id)
    if not week:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Week '{request.week_id}' not found.",
        )

    try:
        job_id = start_evaluation_job(
            week_id=request.week_id,
            staging_token=request.staging_token,
            continue_on_error=request.continue_on_error,
            section=request.section or "Section A",
        )
        job_info = get_evaluation_job(job_id)
        return job_info
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/api/evaluations/{job_id}/progress",
    response_model=EvaluationJobResponse,
)
def get_evaluation_progress(job_id: str):
    """Poll real-time progress for an ongoing evaluation job."""
    job = get_evaluation_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation job '{job_id}' was not found.",
        )
    return job
