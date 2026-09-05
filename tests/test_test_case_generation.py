"""
Unit tests for test case generation, 50+ case synthesizers, and dual model dispatcher.
"""

import asyncio

from problem_engine.problem_schema import Problem, ProblemPack
from problem_engine.test_case_generator import (
    _synthesize_50_plus_cases,
    generate_problem_test_cases,
    generate_pack_test_cases,
)


def test_generate_50_plus_even_odd():
    prob = Problem(
        problem_id="P1",
        title="Check Even or Odd",
        statement="Write a C program to check whether a given number is even or odd.",
    )
    cases = asyncio.run(generate_problem_test_cases(prob, provider="qwen", target_count=50))
    assert len(cases) >= 50
    assert len(prob.test_cases) >= 50
    for tc in cases:
        assert tc.validation_status in ["passed", "manual_review_required"]
        assert tc.test_id.startswith("P1-T")


def test_generate_50_plus_largest_of_three():
    prob = Problem(
        problem_id="P2",
        title="Largest of Three Numbers",
        statement="Write a C program to find the largest of three numbers.",
    )
    cases = asyncio.run(generate_problem_test_cases(prob, provider="qwen", target_count=50))
    assert len(cases) >= 50
    for tc in cases:
        assert tc.validation_status == "passed"


def test_synthesizer_categories_diversity():
    prob = Problem(
        problem_id="P1",
        title="Even or Odd",
        statement="even or odd",
    )
    cases = _synthesize_50_plus_cases(prob, target_count=50)
    assert len(cases) == 50
    categories = {tc.category for tc in cases}
    assert "base" in categories
    assert "boundary" in categories
    assert "edge" in categories
    assert "stress" in categories


def test_generate_pack_test_cases():
    p1 = Problem(
        problem_id="P1",
        title="Even or Odd",
        statement="Check even or odd",
    )
    p2 = Problem(
        problem_id="P2",
        title="Largest of Three",
        statement="Find largest of three numbers",
    )
    pack = ProblemPack(
        problem_pack_id="pack-test",
        title="Test Pack",
        problems=[p1, p2],
    )
    res_pack = asyncio.run(generate_pack_test_cases(pack, provider="qwen", target_count=10))
    assert res_pack.generation_status == "generated"
    assert len(res_pack.problems[0].test_cases) >= 10
    assert len(res_pack.problems[1].test_cases) >= 10
