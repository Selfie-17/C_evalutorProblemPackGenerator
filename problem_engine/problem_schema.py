"""
Canonical Pydantic Schema for Problem Packs, Problems, and Test Cases (Version 1.0).
Provides deterministic, strictly validated models for problem packs and round-trip JSON serialization.
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

CURRENT_SCHEMA_VERSION = "1.0"

TestCaseCategory = Literal[
    "base",
    "boundary",
    "edge",
    "failing",
    "invalid_input",
    "special",
    "stress",
    "metamorphic",
]

TestCaseSeverity = Literal["normal", "critical", "optional"]
ValidationStatus = Literal["passed", "failed", "manual_review_required"]


class TestCase(BaseModel):
    """Represents a single deterministic test case for a C problem."""
    model_config = ConfigDict(extra="ignore")

    test_id: str = Field(..., description="Unique test case identifier (e.g. P1-T01)")
    category: TestCaseCategory = Field(
        default="base",
        description="Category: base, boundary, edge, failing, invalid_input, special, stress, metamorphic"
    )
    input: str = Field(..., description="Exact standard input string (machine-readable)")
    expected_output: str = Field(..., description="Exact expected standard output (machine-readable)")
    reason: str = Field(..., description="Educational justification / purpose of this test case")
    severity: TestCaseSeverity = Field(default="normal", description="Severity weight: normal, critical, optional")
    validation_status: Optional[ValidationStatus] = Field(
        default=None,
        description="Deterministic Python verification status: passed, failed, manual_review_required"
    )
    validation_notes: Optional[str] = Field(
        default=None,
        description="Notes or diagnostic output from deterministic validator"
    )

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v: str) -> str:
        if v == "invalid":
            return "invalid_input"
        return v



class Classification(BaseModel):
    """Categorization and construct requirements for a problem."""
    model_config = ConfigDict(extra="ignore")

    category: str = Field(
        default="conditional",
        description="Problem domain: conditional, menu-driven, loop, number-property, etc."
    )
    difficulty: str = Field(default="easy", description="Subjective difficulty: easy, medium, hard")
    required_constructs: List[str] = Field(
        default_factory=list,
        description="Required C language constructs (e.g. switch, ternary operator, if-else, while)"
    )


class TestStrategy(BaseModel):
    """Recommended target test case distribution by category."""
    model_config = ConfigDict(extra="ignore")

    base_cases: int = Field(default=2, ge=0)
    boundary_cases: int = Field(default=2, ge=0)
    edge_cases: int = Field(default=2, ge=0)
    failing_cases: int = Field(default=0, ge=0)
    special_cases: int = Field(default=1, ge=0)
    invalid_input_cases: int = Field(default=0, ge=0)
    stress_cases: int = Field(default=0, ge=0)
    metamorphic_cases: int = Field(default=0, ge=0)


class Problem(BaseModel):
    """Represents an individual laboratory problem in the pack."""
    model_config = ConfigDict(extra="ignore")

    problem_id: str = Field(..., description="Problem identifier: P1, P2, etc.")
    title: str = Field(..., description="Concise, descriptive title for the problem")
    statement: str = Field(..., description="Full problem statement / description")
    original_statement: Optional[str] = Field(
        default=None,
        description="Exact raw problem statement provided by teacher before any normalization"
    )
    requirements: List[str] = Field(
        default_factory=list,
        description="Explicit functional requirements for the student's solution"
    )
    concepts: List[str] = Field(
        default_factory=list,
        description="Core programming concepts tested (e.g. modulus, recursion, ternary)"
    )
    constraints: List[str] = Field(
        default_factory=list,
        description="Technical constraints (e.g. do not use sqrt(), integer range -10^9 to 10^9)"
    )
    classification: Classification = Field(default_factory=Classification)
    test_strategy: TestStrategy = Field(default_factory=TestStrategy)
    test_cases: List[TestCase] = Field(default_factory=list)
    reference_solution_c: Optional[str] = Field(
        default=None,
        description="Verified reference C implementation (optional)"
    )
    division_approved: bool = Field(
        default=False,
        description="Flag indicating if the human teacher approved the AI-proposed problem division"
    )


class ProblemPack(BaseModel):
    """
    Canonical Problem Pack Schema (Version 1.0).
    Encapsulates curriculum problem statements, classifications, and comprehensive test suites.
    """
    model_config = ConfigDict(extra="ignore")

    schema_version: str = Field(
        default=CURRENT_SCHEMA_VERSION,
        description="Schema specification version (e.g. 1.0)"
    )
    problem_pack_id: str = Field(
        default="week-01",
        description="Unique pack identifier (e.g. week-01, lab-pack-c-basics)"
    )
    title: str = Field(default="C Programming Problem Pack", description="Pack title")
    language: str = Field(default="C", description="Programming language target")
    total_problems: int = Field(default=0, ge=0, description="Total problem count in this pack")
    problems: List[Problem] = Field(default_factory=list, description="Ordered list of problems")
    generation_status: str = Field(
        default="draft",
        description="Workflow state: draft, parsed, division_approved, generated, reviewed, approved"
    )
