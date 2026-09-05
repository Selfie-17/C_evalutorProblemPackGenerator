"""
Unit tests for canonical ProblemPack and TestCase Pydantic schemas (v1.0).
"""

import pytest
from pydantic import ValidationError

from problem_engine.problem_schema import (
    CURRENT_SCHEMA_VERSION,
    Classification,
    Problem,
    ProblemPack,
    TestCase,
    TestStrategy,
)


def test_schema_version_default():
    pack = ProblemPack()
    assert pack.schema_version == CURRENT_SCHEMA_VERSION
    assert pack.schema_version == "1.0"


def test_test_case_creation_and_defaults():
    tc = TestCase(
        test_id="P1-T01",
        category="base",
        input="10\n",
        expected_output="Even\n",
        reason="Standard even integer",
    )
    assert tc.test_id == "P1-T01"
    assert tc.category == "base"
    assert tc.severity == "normal"
    assert tc.validation_status is None


def test_test_case_category_validation():
    # Valid categories
    for cat in ["base", "boundary", "edge", "failing", "invalid_input", "special", "stress", "metamorphic"]:
        tc = TestCase(
            test_id="T1",
            category=cat,  # type: ignore
            input="1",
            expected_output="1",
            reason="Test",
        )
        assert tc.category == cat

    # Invalid category should raise ValidationError
    with pytest.raises(ValidationError):
        TestCase(
            test_id="T2",
            category="unsupported_category",  # type: ignore
            input="1",
            expected_output="1",
            reason="Test",
        )


def test_problem_creation():
    problem = Problem(
        problem_id="P1",
        title="Check Even or Odd",
        statement="Check if n is even or odd",
        requirements=["Return Even or Odd"],
        concepts=["modulo"],
        constraints=["-10^9 <= n <= 10^9"],
    )
    assert problem.problem_id == "P1"
    assert problem.title == "Check Even or Odd"
    assert problem.division_approved is False
    assert problem.test_cases == []
    assert isinstance(problem.classification, Classification)
    assert isinstance(problem.test_strategy, TestStrategy)
