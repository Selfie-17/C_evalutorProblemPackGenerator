import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response, status

from app.database.db import get_week
from app.models import WeekAnalyticsResponse
from app.services.analytics import compute_week_analytics
from app.services.export import (
    generate_consolidated_week_json,
    generate_student_export_dict,
    generate_week_results_zip,
)

router = APIRouter(prefix="/api/weeks/{week_id}", tags=["Analytics & Export"])


@router.get("/analytics", response_model=WeekAnalyticsResponse)
def get_week_analytics(week_id: str, section: Optional[str] = Query(None)):
    """Retrieve comprehensive week analytics, pass rates, and problem statistics (optionally filtered by section)."""
    try:
        return compute_week_analytics(week_id, section=section)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/students/{student_id}/export")
def export_student_json(week_id: str, student_id: str):
    """Download detailed results JSON for an individual student."""
    try:
        data = generate_student_export_dict(week_id, student_id)
        week = get_week(week_id)
        week_num = week.week_number if week else 1
        filename = f"student_{student_id}_week_{week_num:02d}.json"
        json_bytes = json.dumps(data, indent=2).encode("utf-8")
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/export/json")
def export_consolidated_week_json(week_id: str, section: Optional[str] = Query(None)):
    """Download consolidated JSON for student evaluations in the week (optionally section-filtered)."""
    try:
        json_str = generate_consolidated_week_json(week_id, section=section)
        week = get_week(week_id)
        week_num = week.week_number if week else 1
        sec_str = f"_{section.replace(' ', '_')}" if section and section.lower() not in ("all", "all sections", "") else ""
        filename = f"week_{week_num:02d}{sec_str}_results.json"
        return Response(
            content=json_str.encode("utf-8"),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/export/zip")
def export_week_results_zip(week_id: str, section: Optional[str] = Query(None)):
    """Download complete ZIP archive containing week_summary.json, students/*.json, and problems/*.json."""
    try:
        zip_bytes = generate_week_results_zip(week_id, section=section)
        week = get_week(week_id)
        week_num = week.week_number if week else 1
        sec_str = f"_{section.replace(' ', '_')}" if section and section.lower() not in ("all", "all sections", "") else ""
        filename = f"week_{week_num:02d}{sec_str}_results.zip"
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
