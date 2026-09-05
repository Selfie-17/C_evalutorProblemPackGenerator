"""
Unit tests for deterministic Python validation of test cases.
"""

from problem_engine.problem_schema import Problem, TestCase
from problem_engine.test_case_validator import (
    validate_calculator,
    validate_character_classification,
    validate_even_odd,
    validate_largest_of_three,
    validate_leap_year,
    validate_perfect_square,
    validate_positive_negative_zero,
    validate_student_grade,
    validate_swap,
    validate_test_case,
)


def test_validate_even_odd():
    status, notes = validate_even_odd("4\n", "Even\n")
    assert status == "passed"

    status, notes = validate_even_odd("7\n", "Odd\n")
    assert status == "passed"

    status, notes = validate_even_odd("0\n", "Even\n")
    assert status == "passed"

    status, notes = validate_even_odd("-8\n", "Even\n")
    assert status == "passed"

    status, notes = validate_even_odd("4\n", "Odd\n")
    assert status == "failed"


def test_validate_positive_negative_zero():
    status, _ = validate_positive_negative_zero("5\n", "Positive\n")
    assert status == "passed"

    status, _ = validate_positive_negative_zero("-12\n", "Negative\n")
    assert status == "passed"

    status, _ = validate_positive_negative_zero("0\n", "Zero\n")
    assert status == "passed"


def test_validate_leap_year():
    # Gregorian rules
    assert validate_leap_year("2024\n", "Leap Year\n")[0] == "passed"
    assert validate_leap_year("2023\n", "Not Leap Year\n")[0] == "passed"
    assert validate_leap_year("2000\n", "Leap Year\n")[0] == "passed"
    assert validate_leap_year("1900\n", "Not Leap Year\n")[0] == "passed"
    assert validate_leap_year("1900\n", "Leap Year\n")[0] == "failed"


def test_validate_largest_of_three():
    assert validate_largest_of_three("10 25 15\n", "25\n")[0] == "passed"
    assert validate_largest_of_three("30 10 20\n", "30\n")[0] == "passed"
    assert validate_largest_of_three("-5 -2 -10\n", "-2\n")[0] == "passed"
    assert validate_largest_of_three("10 25 15\n", "10\n")[0] == "failed"


def test_validate_swap():
    assert validate_swap("10 20\n", "20 10\n")[0] == "passed"
    assert validate_swap("5 99\n", "99 5\n")[0] == "passed"
    assert validate_swap("10 20\n", "10 20\n")[0] == "failed"


def test_validate_perfect_square():
    assert validate_perfect_square("16\n", "Perfect Square\n")[0] == "passed"
    assert validate_perfect_square("17\n", "Not Perfect Square\n")[0] == "passed"
    assert validate_perfect_square("0\n", "Perfect Square\n")[0] == "passed"
    assert validate_perfect_square("1\n", "Perfect Square\n")[0] == "passed"
    assert validate_perfect_square("-4\n", "Not Perfect Square\n")[0] == "passed"
    assert validate_perfect_square("16\n", "Not Perfect Square\n")[0] == "failed"


def test_validate_calculator():
    # Choice 1: Add
    assert validate_calculator("1 10 20\n", "30\n")[0] == "passed"
    # Choice 3: Multiply
    assert validate_calculator("3 6 7\n", "42\n")[0] == "passed"
    # Choice 4: Division by zero
    assert validate_calculator("4 10 0\n", "Error: Division by zero\n")[0] == "passed"
    # Invalid choice
    assert validate_calculator("99 5 5\n", "Invalid choice\n")[0] == "passed"


def test_validate_character_classification():
    assert validate_character_classification("A\n", "Uppercase\n")[0] == "passed"
    assert validate_character_classification("z\n", "Lowercase\n")[0] == "passed"
    assert validate_character_classification("5\n", "Digit\n")[0] == "passed"
    assert validate_character_classification("@\n", "Special\n")[0] == "passed"


def test_validate_student_grade():
    assert validate_student_grade("95\n", "Grade A\n")[0] == "passed"
    assert validate_student_grade("85\n", "Grade B\n")[0] == "passed"
    assert validate_student_grade("75\n", "Grade C\n")[0] == "passed"
    assert validate_student_grade("30\n", "Fail\n")[0] == "passed"


def test_validate_test_case_dispatcher():
    prob = Problem(
        problem_id="P1",
        title="Check Even or Odd",
        statement="Check if number is even or odd",
    )
    tc = TestCase(
        test_id="P1-T01",
        category="base",
        input="42\n",
        expected_output="Even\n",
        reason="Positive even",
    )
    validate_test_case(prob, tc)
    assert tc.validation_status == "passed"
    assert "42 is Even" in (tc.validation_notes or "")
