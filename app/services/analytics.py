from typing import Dict, List, Optional

from app.database.db import (
    get_student_submissions,
    get_student_summary,
    get_week,
    get_week_problems,
    get_week_sections,
    get_week_students,
    list_week_student_summaries,
)
from app.models import (
    JudgeVerdict,
    ProblemAnalyticsItem,
    ProblemInPack,
    StudentDetailResponse,
    StudentSummaryItem,
    VerdictDistribution,
    WeekAnalyticsResponse,
)


def compute_week_analytics(week_id: str, section: Optional[str] = None) -> WeekAnalyticsResponse:
    """
    Compute aggregated statistics and problem breakdowns for a week,
    optionally filtered by class section.
    """
    week = get_week(week_id)
    if not week:
        raise ValueError(f"Week '{week_id}' not found.")

    available_sections = get_week_sections(week_id)
    filter_sec = section if section and section.lower() not in ("all", "all sections", "") else None

    problems = get_week_problems(week_id)
    students = get_week_students(week_id, section=filter_sec)
    student_summaries = [get_student_summary(week_id, sid) for sid in students]

    total_students = len(students)
    total_programs = total_students * len(problems)

    # Collect all submissions for this week (or section)
    all_submissions = []
    for sid in students:
        all_submissions.extend(get_student_submissions(week_id, sid))

    # Verdict distribution
    verdicts = VerdictDistribution()
    total_passed_cases = 0
    total_configured_cases = 0
    times = []

    for sub in all_submissions:
        if sub.verdict == JudgeVerdict.ACCEPTED:
            verdicts.accepted += 1
        elif sub.verdict == JudgeVerdict.WRONG_ANSWER:
            verdicts.wrong_answer += 1
        elif sub.verdict == JudgeVerdict.COMPILATION_ERROR:
            verdicts.compilation_error += 1
        elif sub.verdict == JudgeVerdict.RUNTIME_ERROR:
            verdicts.runtime_error += 1
        elif sub.verdict == JudgeVerdict.TIME_LIMIT_EXCEEDED:
            verdicts.time_limit_exceeded += 1
        elif sub.verdict == JudgeVerdict.NOT_SUBMITTED:
            verdicts.not_submitted += 1

        total_passed_cases += sub.passed_test_cases
        total_configured_cases += sub.total_test_cases
        if sub.total_time_ms > 0:
            times.append(sub.total_time_ms)

    overall_ac_rate = (
        round((verdicts.accepted / total_programs * 100), 1)
        if total_programs > 0
        else 0.0
    )
    avg_tc_pct = (
        round((total_passed_cases / total_configured_cases * 100), 1)
        if total_configured_cases > 0
        else 0.0
    )
    avg_time = round(sum(times) / len(times), 2) if times else 0.0

    # Per-problem analytics
    problem_stats: List[ProblemAnalyticsItem] = []
    for prob in problems:
        prob_subs = [s for s in all_submissions if s.problem_id == prob.id or s.problem_number == prob.number]
        p_total = len(prob_subs)
        p_ac = sum(1 for s in prob_subs if s.verdict == JudgeVerdict.ACCEPTED)
        p_wa = sum(1 for s in prob_subs if s.verdict == JudgeVerdict.WRONG_ANSWER)
        p_ce = sum(1 for s in prob_subs if s.verdict == JudgeVerdict.COMPILATION_ERROR)
        p_re = sum(1 for s in prob_subs if s.verdict == JudgeVerdict.RUNTIME_ERROR)
        p_tle = sum(1 for s in prob_subs if s.verdict == JudgeVerdict.TIME_LIMIT_EXCEEDED)
        p_times = [s.total_time_ms for s in prob_subs if s.total_time_ms > 0]
        p_avg_time = round(sum(p_times) / len(p_times), 2) if p_times else 0.0
        p_ac_rate = round((p_ac / p_total * 100), 1) if p_total > 0 else 0.0

        problem_stats.append(
            ProblemAnalyticsItem(
                problem_number=prob.number,
                problem_id=prob.id,
                title=prob.title,
                difficulty=prob.difficulty,
                total_submissions=p_total,
                accepted_count=p_ac,
                wrong_answer_count=p_wa,
                compilation_error_count=p_ce,
                runtime_error_count=p_re,
                tle_count=p_tle,
                acceptance_rate=p_ac_rate,
                avg_time_ms=p_avg_time,
            )
        )

    # Top students (solved 100% or >= 8)
    top_students = [
        s.student_id for s in student_summaries if s.solved_count >= len(problems) and s.solved_count > 0
    ]
    if not top_students and student_summaries:
        max_solved = max(s.solved_count for s in student_summaries)
        if max_solved > 0:
            top_students = [s.student_id for s in student_summaries if s.solved_count == max_solved]

    # Struggling students (acceptance rate < 50% or >= 2 compilation errors)
    struggling_students = [
        s.student_id
        for s in student_summaries
        if (s.acceptance_rate < 50.0 or s.compilation_errors >= 2)
        and s.not_submitted < len(problems)
    ]

    return WeekAnalyticsResponse(
        week_id=week_id,
        week_number=week.week_number,
        title=week.title,
        section=filter_sec,
        available_sections=available_sections,
        total_students=total_students,
        total_programs=total_programs,
        verdicts=verdicts,
        overall_acceptance_rate=overall_ac_rate,
        avg_test_cases_passed_pct=avg_tc_pct,
        avg_execution_time_ms=avg_time,
        problem_stats=problem_stats,
        top_students=top_students[:10],
        struggling_students=struggling_students[:10],
    )


def compute_student_detail(week_id: str, student_id: str) -> StudentDetailResponse:
    """
    Get detailed breakdown of a student's submission in a given week.
    """
    week = get_week(week_id)
    if not week:
        raise ValueError(f"Week '{week_id}' not found.")

    summary = get_student_summary(week_id, student_id)
    submissions = get_student_submissions(week_id, student_id)

    return StudentDetailResponse(
        student_id=student_id,
        week_id=week_id,
        week_number=week.week_number,
        summary=summary,
        submissions=submissions,
    )
