from typing import List
from fastapi import APIRouter, HTTPException, Response, status

from app.database.db import (
    create_week,
    delete_single_problem,
    delete_week,
    delete_week_problems,
    get_problem_by_id,
    get_week,
    get_week_problems,
    list_weeks,
    update_week,
)
from app.models import (
    GenerateFromQuestionsRequest,
    GeneratePackRequest,
    GeneratePackResponse,
    GenerateSingleQuestionRequest,
    GenerateSingleQuestionResponse,
    ProblemInPack,
    WeekCreateRequest,
    WeekResponse,
    WeekUpdateRequest,
)
from app.services.export import generate_problem_pack_zip
from app.services.pack_generator import (
    generate_problems_from_exact_questions,
    generate_single_problem_from_exact_question,
    generate_week_problem_pack,
    seed_default_pack_for_week,
)

router = APIRouter(prefix="/api/weeks", tags=["Weeks & Problem Packs"])


@router.get("", response_model=List[WeekResponse])
def get_all_weeks():
    """List all configured lab weeks."""
    return list_weeks()


@router.post("", response_model=WeekResponse, status_code=status.HTTP_201_CREATED)
def add_week(request: WeekCreateRequest):
    """Create a new week entity."""
    existing = get_week(f"week-{request.week_number:02d}")
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Week {request.week_number} already exists.",
        )
    return create_week(
        week_number=request.week_number,
        title=request.title,
        description=request.description or "",
    )


@router.get("/{week_id}", response_model=WeekResponse)
def get_single_week(week_id: str):
    """Retrieve details and statistics for a specific week."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    return week


@router.put("/{week_id}", response_model=WeekResponse)
def update_single_week(week_id: str, request: WeekUpdateRequest):
    """Update title, description, or status for a week."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    return update_week(
        week_id=week_id,
        title=request.title,
        description=request.description,
        status=request.status,
    )


@router.delete("/{week_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_week(week_id: str):
    """Delete a week and cascade delete all problems and submissions."""
    success = delete_week(week_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    return None


@router.post("/{week_id}/generate-pack", response_model=GeneratePackResponse)
async def generate_pack(week_id: str, request: GeneratePackRequest):
    """Generate or seed a complete 10-problem pack (P1..P10) with reference verification."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    response = await generate_week_problem_pack(week_id=week_id, request=request)
    return response


@router.post("/{week_id}/seed-default-pack", response_model=List[ProblemInPack])
def seed_pack(week_id: str):
    """Instantly seed pre-verified standard LeetCode-style C problems for the week."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    problems = seed_default_pack_for_week(week_id=week_id, week_number=week.week_number)
    return problems


@router.get("/{week_id}/problems", response_model=List[ProblemInPack])
def list_problems_in_week(week_id: str):
    """Retrieve all problems configured for a week (P1..P10)."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    return get_week_problems(week_id)


@router.delete("/{week_id}/problems", status_code=status.HTTP_200_OK)
def remove_week_problems(week_id: str):
    """Delete all problems in the problem pack for a week."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    deleted_count = delete_week_problems(week_id)
    return {
        "status": "success",
        "message": f"Deleted {deleted_count} problems from week '{week_id}'.",
        "deleted_count": deleted_count,
    }


@router.delete("/{week_id}/problems/{problem_number_or_id}", status_code=status.HTTP_200_OK)
def remove_single_problem(week_id: str, problem_number_or_id: str):
    """Delete a single problem from a week by its problem number or ID."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    success = delete_single_problem(week_id, problem_number_or_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found.")
    return {"status": "success", "message": f"Problem {problem_number_or_id} deleted."}


@router.post("/{week_id}/generate-from-questions", response_model=GeneratePackResponse)
async def generate_from_questions(week_id: str, request: GenerateFromQuestionsRequest):
    """
    Generate a complete LeetCode-style C problem pack from exact questions provided by the instructor.
    Automatically generates descriptions, test cases, and compiles/verifies C reference solutions.
    """
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    response = await generate_problems_from_exact_questions(week_id=week_id, request=request)
    return response


@router.post("/{week_id}/generate-single-question", response_model=GenerateSingleQuestionResponse)
async def generate_single_question(week_id: str, request: GenerateSingleQuestionRequest):
    """
    Generate, verify with GCC, and save a single LeetCode-style C problem from an exact instructor question.
    Generates exactly 5 diverse test cases (2 public, 3 hidden edge/failure cases).
    """
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    response = await generate_single_problem_from_exact_question(week_id=week_id, request=request)
    return response


@router.get("/{week_id}/export-pack")
def export_problem_pack(week_id: str):
    """Download Week problem pack archive containing P1.json..P10.json and problem_pack.json."""
    week = get_week(week_id)
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Week '{week_id}' not found.")
    zip_bytes = generate_problem_pack_zip(week_id)
    filename = f"Week_{week.week_number:02d}_Problems.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
