"""
Problem Pack Manager.
Coordinates the end-to-end lifecycle of a ProblemPack:
Parsing -> Classification -> Division Approval -> Test Case Generation (Qwen/Gemini, 50+ cases)
-> Deterministic Validation -> Canonical JSON Export/Import -> Lab Week Deployment.
"""

import re
import logging
from typing import Any, Dict, List, Optional

from problem_engine.json_io import export_problem_pack_json, import_problem_pack_json
from problem_engine.problem_classifier import (
    classify_problem_pack,
    classify_problem_with_qwen,
    classify_problems_batch_all,
)
from problem_engine.problem_parser import parse_raw_problems
from problem_engine.problem_schema import (
    CURRENT_SCHEMA_VERSION,
    Problem,
    ProblemPack,
    TestCase,
)
from problem_engine.test_case_generator import (
    generate_pack_test_cases,
    generate_problem_test_cases,
)
from problem_engine.test_case_validator import validate_all_test_cases, validate_test_case

logger = logging.getLogger(__name__)


def _slugify(title: str) -> str:
    """Convert a title string into a clean URL-friendly slug."""
    s = title.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-") or "problem"


class ProblemPackManager:
    """High-level coordinator for problem pack workflows."""

    @staticmethod
    def parse_raw_text(
        raw_text: str,
        pack_id: str = "week-01",
        title: str = "C Laboratory Problem Pack",
    ) -> ProblemPack:
        """Parse raw multiline input into an initial ProblemPack with unapproved division."""
        problems = parse_raw_problems(raw_text)
        return ProblemPack(
            schema_version=CURRENT_SCHEMA_VERSION,
            problem_pack_id=pack_id,
            title=title,
            language="C",
            total_problems=len(problems),
            problems=problems,
            generation_status="parsed",
        )

    @staticmethod
    async def classify_pack(pack: ProblemPack) -> ProblemPack:
        """Run classification on all problems in the pack."""
        pack.problems = await classify_problem_pack(pack.problems)
        return pack

    @staticmethod
    async def classify_pack_batch(
        pack: ProblemPack,
        provider: str = "qwen",
        api_key: Optional[str] = None,
    ) -> ProblemPack:
        """Feed all problems in the pack simultaneously in a single batch prompt to Qwen or Gemini."""
        pack.problems = await classify_problems_batch_all(pack.problems, provider=provider, api_key=api_key)
        return pack

    @staticmethod
    async def classify_single_problem(problem: Problem) -> Problem:
        """Classify a single problem."""
        return await classify_problem_with_qwen(problem)

    @staticmethod
    def approve_division(pack: ProblemPack) -> ProblemPack:
        """Mark division approved by the teacher across all problems."""
        for p in pack.problems:
            p.division_approved = True
        pack.generation_status = "division_approved"
        return pack

    @staticmethod
    async def generate_tests_for_problem(
        problem: Problem,
        provider: str = "qwen",
        target_count: int = 50,
        gemini_api_key: Optional[str] = None,
    ) -> Problem:
        """Generate test cases for a single problem using Qwen or Gemini."""
        await generate_problem_test_cases(
            problem=problem,
            provider=provider,
            target_count=target_count,
            gemini_api_key=gemini_api_key,
        )
        return problem

    @staticmethod
    async def generate_tests_for_pack(
        pack: ProblemPack,
        provider: str = "qwen",
        target_count: int = 50,
        gemini_api_key: Optional[str] = None,
    ) -> ProblemPack:
        """Generate test cases sequentially across all problems in the pack."""
        await generate_pack_test_cases(
            pack=pack,
            provider=provider,
            target_count=target_count,
            gemini_api_key=gemini_api_key,
        )
        return pack

    @staticmethod
    def validate_problem_cases(problem: Problem) -> Problem:
        """Run deterministic Python validation across all test cases on a problem."""
        return validate_all_test_cases(problem)

    @staticmethod
    def validate_pack_cases(pack: ProblemPack) -> ProblemPack:
        """Run deterministic Python validation across all test cases on all problems in pack."""
        for p in pack.problems:
            validate_all_test_cases(p)
        return pack

    @staticmethod
    def export_json(pack: ProblemPack, indent: int = 2) -> str:
        """Export canonical JSON."""
        return export_problem_pack_json(pack, indent=indent)

    @staticmethod
    def import_json(raw_json: Any) -> ProblemPack:
        """Import and validate canonical JSON."""
        return import_problem_pack_json(raw_json)

    @staticmethod
    def deploy_to_laboratory_week(pack: ProblemPack, week_id: str, replace_all: bool = False) -> Dict[str, Any]:
        """
        Bridge ProblemPack into the platform's SQLite database for laboratory evaluation.
        Converts canonical problems into ProblemInPack records and commits them to the specified week.
        """
        from app.database.db import (
            delete_week_problems,
            get_week,
            get_week_problems,
            save_problem,
            update_week,
        )
        from app.models import ProblemInPack, TestCaseSchema

        week = get_week(week_id)
        if not week:
            raise ValueError(f"Target laboratory week '{week_id}' does not exist.")

        existing = get_week_problems(week_id)
        if replace_all:
            delete_week_problems(week_id)
            next_num = 1
        else:
            existing_numbers = {p.number for p in existing}
            next_num = max(existing_numbers, default=0) + 1

        deployed_count = 0
        for idx, p in enumerate(pack.problems, start=1):
            prob_num = next_num
            next_num += 1
            public_cases: List[TestCaseSchema] = []
            hidden_cases: List[TestCaseSchema] = []

            # Partition test cases: first 2-3 standard cases as public, rest as hidden
            for t_idx, tc in enumerate(p.test_cases):
                tc_schema = TestCaseSchema(
                    input=tc.input,
                    expected_output=tc.expected_output,
                    description=tc.reason,
                    is_hidden=(t_idx >= 3),
                )
                if t_idx < 3:
                    public_cases.append(tc_schema)
                else:
                    hidden_cases.append(tc_schema)

            # If no public cases, make at least one public
            if not public_cases and hidden_cases:
                public_cases.append(hidden_cases.pop(0))

            diff_str = p.classification.difficulty.capitalize()
            if diff_str not in ["Easy", "Medium", "Hard"]:
                diff_str = "Easy"

            p_in_pack = ProblemInPack(
                id=f"{week_id}-p{prob_num}",
                week_id=week_id,
                number=prob_num,
                title=p.title,
                slug=_slugify(f"{p.title}-{prob_num}"),
                description=p.statement,
                input_format="Standard input as specified in problem statement.",
                output_format="Standard output matching exact expected format.",
                constraints=p.constraints,
                difficulty=diff_str,
                topics=p.concepts,
                hints=[r for r in p.requirements],
                time_limit=2.0,
                public_test_cases=public_cases,
                hidden_test_cases=hidden_cases,
                reference_solution_c=p.reference_solution_c or "",
                is_verified=True,
            )

            save_problem(p_in_pack)
            deployed_count += 1

        update_week(week_id, status="active")

        return {
            "success": True,
            "week_id": week_id,
            "week_title": week.title,
            "deployed_problems": deployed_count,
            "message": f"Successfully deployed {deployed_count} problems to {week.title}.",
        }
