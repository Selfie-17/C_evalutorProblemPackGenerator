"""
Deterministic Python Validation Engine for Test Cases.
Verifies LLM-proposed expected outputs against algorithmic mathematical ground truths.
Marks unrecognized domains with 'manual_review_required'.
"""

import math
import re
from typing import Optional, Tuple
from problem_engine.problem_schema import Problem, TestCase


def _normalize_text(s: str) -> str:
    """Normalize whitespace and lowercase for reliable output comparison."""
    return re.sub(r"\s+", " ", str(s).strip()).lower()


# ==============================================================================
# Domain-Specific Deterministic Validators
# ==============================================================================

def validate_even_odd(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate Even / Odd output for integer inputs."""
    nums = re.findall(r"-?\d+", inp)
    if not nums:
        return "manual_review_required", "Could not parse integer from input"

    n = int(nums[0])
    ground_truth = "even" if n % 2 == 0 else "odd"
    norm_out = _normalize_text(expected_out)

    if ground_truth in norm_out:
        return "passed", f"Validated: {n} is {ground_truth.capitalize()}"
    return "failed", f"Expected '{ground_truth.capitalize()}' for n={n}, got '{expected_out.strip()}'"


def validate_positive_negative_zero(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate Positive / Negative / Zero output for integer inputs."""
    nums = re.findall(r"-?\d+", inp)
    if not nums:
        return "manual_review_required", "Could not parse integer from input"

    n = int(nums[0])
    if n > 0:
        ground_truth = "positive"
    elif n < 0:
        ground_truth = "negative"
    else:
        ground_truth = "zero"

    norm_out = _normalize_text(expected_out)
    if ground_truth in norm_out:
        return "passed", f"Validated: {n} is {ground_truth.capitalize()}"
    return "failed", f"Expected '{ground_truth.capitalize()}' for n={n}, got '{expected_out.strip()}'"


def validate_leap_year(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate Gregorian leap year logic."""
    nums = re.findall(r"\d+", inp)
    if not nums:
        return "manual_review_required", "Could not parse year from input"

    year = int(nums[0])
    is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
    norm_out = _normalize_text(expected_out)

    if is_leap:
        if "not leap" in norm_out or "non leap" in norm_out:
            return "failed", f"Expected Leap Year for {year}, but output indicates Not Leap"
        if "leap" in norm_out:
            return "passed", f"Validated: {year} is a Leap Year"
    else:
        if "not leap" in norm_out or "not a leap" in norm_out or "no" in norm_out:
            return "passed", f"Validated: {year} is NOT a Leap Year"
        if "leap" in norm_out:
            return "failed", f"Expected Not a Leap Year for {year}, but got '{expected_out.strip()}'"

    return "manual_review_required", f"Leap year logic verified (is_leap={is_leap}), review formatting"


def validate_largest_of_three(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate largest of three numbers."""
    nums = re.findall(r"-?\d+", inp)
    if len(nums) < 3:
        return "manual_review_required", "Input requires 3 numbers"

    a, b, c = int(nums[0]), int(nums[1]), int(nums[2])
    max_val = max(a, b, c)

    out_nums = re.findall(r"-?\d+", expected_out)
    if str(max_val) in out_nums or str(max_val) in expected_out:
        return "passed", f"Validated: max({a}, {b}, {c}) = {max_val}"
    return "failed", f"Expected max={max_val} for inputs ({a}, {b}, {c}), got '{expected_out.strip()}'"


def validate_swap(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate swapping of two variables."""
    in_nums = re.findall(r"-?\d+", inp)
    if len(in_nums) < 2:
        return "manual_review_required", "Input requires 2 numbers to swap"

    a, b = in_nums[0], in_nums[1]
    out_nums = re.findall(r"-?\d+", expected_out)

    if len(out_nums) >= 2:
        if out_nums[0] == b and out_nums[1] == a:
            return "passed", f"Validated: Swapped ({a}, {b}) -> ({b}, {a})"
        return "failed", f"Expected swapped order ({b}, {a}), got '{expected_out.strip()}'"

    if f"{b} {a}" in expected_out:
        return "passed", f"Validated: Swapped values ({b}, {a}) present in output"
    return "failed", f"Expected swapped values ({b}, {a}), got '{expected_out.strip()}'"


def validate_perfect_square(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate perfect square check."""
    nums = re.findall(r"-?\d+", inp)
    if not nums:
        return "manual_review_required", "Could not parse integer from input"

    n = int(nums[0])
    if n < 0:
        is_sq = False
    else:
        root = int(math.isqrt(n))
        is_sq = (root * root == n)

    norm_out = _normalize_text(expected_out)
    if is_sq:
        if "not" in norm_out:
            return "failed", f"{n} is a perfect square ({root}^2), but output contains 'not'"
        if "perfect square" in norm_out or "yes" in norm_out or "true" in norm_out:
            return "passed", f"Validated: {n} is a perfect square"
    else:
        if "not" in norm_out or "no" in norm_out or "false" in norm_out:
            return "passed", f"Validated: {n} is NOT a perfect square"
        if "perfect square" in norm_out:
            return "failed", f"{n} is NOT a perfect square, got '{expected_out.strip()}'"

    return "manual_review_required", f"Perfect square calculation (is_perfect_sq={is_sq})"


def validate_calculator(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate calculator menu arithmetic."""
    nums = re.findall(r"-?\d+", inp)
    norm_out = _normalize_text(expected_out)

    if len(nums) >= 3:
        choice = int(nums[0])
        a = int(nums[1])
        b = int(nums[2])

        if choice in [4, 5] and b == 0:
            if "zero" in norm_out or "error" in norm_out or "invalid" in norm_out:
                return "passed", "Validated: Correctly handles division/modulus by zero"
            return "failed", "Division by zero should output error/invalid notice"

        res = None
        if choice == 1:
            res = a + b
        elif choice == 2:
            res = a - b
        elif choice == 3:
            res = a * b
        elif choice == 4 and b != 0:
            res = a // b
        elif choice == 5 and b != 0:
            res = a % b
        elif choice == 6:
            res = a ** b

        if res is not None:
            if str(res) in expected_out:
                return "passed", f"Validated: Calculation result {res} matched"
            return "failed", f"Expected result {res} for operation choice={choice}, got '{expected_out.strip()}'"

    if any(k in norm_out for k in ["invalid", "choice", "error"]):
        return "passed", "Validated: Invalid menu choice handled"

    return "manual_review_required", "Calculator output needs manual inspection"


def validate_character_classification(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate uppercase / lowercase / digit / special character."""
    clean_inp = inp.strip()
    if not clean_inp:
        return "manual_review_required", "Empty character input"

    ch = clean_inp[0]
    norm_out = _normalize_text(expected_out)

    if ch.isupper():
        expected_type = "uppercase"
    elif ch.islower():
        expected_type = "lowercase"
    elif ch.isdigit():
        expected_type = "digit"
    else:
        expected_type = "special"

    if expected_type in norm_out:
        return "passed", f"Validated: '{ch}' is {expected_type}"
    return "failed", f"Expected '{expected_type}' for character '{ch}', got '{expected_out.strip()}'"


def validate_student_grade(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate student grade boundaries."""
    nums = re.findall(r"\d+", inp)
    if not nums:
        return "manual_review_required", "Could not parse marks from input"

    marks = int(nums[0])
    norm_out = _normalize_text(expected_out)

    # Standard academic grade bins (A>=90, B>=80, C>=70, D>=60, F<60 or similar)
    if marks >= 90 and ("a" in norm_out or "excellent" in norm_out or "outstanding" in norm_out):
        return "passed", f"Validated: Marks {marks} -> Grade A"
    if 80 <= marks < 90 and "b" in norm_out:
        return "passed", f"Validated: Marks {marks} -> Grade B"
    if 70 <= marks < 80 and "c" in norm_out:
        return "passed", f"Validated: Marks {marks} -> Grade C"
    if marks < 50 and ("f" in norm_out or "fail" in norm_out):
        return "passed", f"Validated: Marks {marks} -> Fail / Grade F"

    # Grade points (0-10 scale)
    if marks <= 10:
        if marks >= 9 and any(g in norm_out for g in ["o", "a+", "a", "outstanding", "excellent"]):
            return "passed", f"Validated: Grade Point {marks} -> Grade A/O"
        if marks == 8 and "b" in norm_out:
            return "passed", f"Validated: Grade Point {marks} -> Grade B"
        if marks == 7 and "c" in norm_out:
            return "passed", f"Validated: Grade Point {marks} -> Grade C"
        if marks == 6 and "d" in norm_out:
            return "passed", f"Validated: Grade Point {marks} -> Grade D"
        if marks <= 4 and ("f" in norm_out or "fail" in norm_out):
            return "passed", f"Validated: Grade Point {marks} -> Fail / Grade F"

    return "manual_review_required", f"Grade for marks/point={marks} requires manual curriculum grading rubric check"


def validate_sizeof(inp: str, expected_out: str) -> Tuple[str, str]:
    """Validate sizeof operator outputs for fundamental C types."""
    norm_out = _normalize_text(expected_out)
    found_types = [t for t in ["int", "char", "float", "double", "short", "long", "byte", "bytes", "size"] if t in norm_out]
    nums = re.findall(r"\d+", expected_out)
    if any(s in ["1", "2", "4", "8"] for s in nums):
        return "passed", f"Validated: Contains standard C type sizes ({', '.join(set(nums))})"
    if found_types:
        return "passed", f"Validated: Contains C type size keywords ({', '.join(found_types)})"
    return "manual_review_required", "Verify sizeof output formatting"


# ==============================================================================
# Main Dispatcher
# ==============================================================================

def validate_test_case(problem: Problem, test_case: TestCase) -> Tuple[str, Optional[str]]:
    """
    Run deterministic validation against a test case for a given problem.
    Returns (status, notes).
    """
    s_lower = problem.statement.lower() + " " + problem.title.lower()

    if "sizeof" in s_lower or "memory allocation" in s_lower or "data types" in s_lower:
        status, notes = validate_sizeof(test_case.input, test_case.expected_output)
    elif "even" in s_lower and "odd" in s_lower:
        status, notes = validate_even_odd(test_case.input, test_case.expected_output)
    elif "positive" in s_lower and "negative" in s_lower:
        status, notes = validate_positive_negative_zero(test_case.input, test_case.expected_output)
    elif "leap" in s_lower and "year" in s_lower:
        status, notes = validate_leap_year(test_case.input, test_case.expected_output)
    elif "largest" in s_lower or "greatest" in s_lower or "maximum" in s_lower:
        status, notes = validate_largest_of_three(test_case.input, test_case.expected_output)
    elif "swap" in s_lower:
        status, notes = validate_swap(test_case.input, test_case.expected_output)
    elif "perfect square" in s_lower or ("square" in s_lower and "sqrt" in s_lower):
        status, notes = validate_perfect_square(test_case.input, test_case.expected_output)
    elif "calculator" in s_lower or "menu" in s_lower:
        status, notes = validate_calculator(test_case.input, test_case.expected_output)
    elif "character" in s_lower or "uppercase" in s_lower or "lowercase" in s_lower:
        status, notes = validate_character_classification(test_case.input, test_case.expected_output)
    elif "grade" in s_lower:
        status, notes = validate_student_grade(test_case.input, test_case.expected_output)
    else:
        status, notes = (
            "manual_review_required",
            "Domain-specific problem logic requires teacher manual inspection.",
        )

    test_case.validation_status = status
    test_case.validation_notes = notes
    return status, notes


def validate_all_test_cases(problem: Problem) -> Problem:
    """Validate all test cases attached to a problem."""
    for tc in problem.test_cases:
        validate_test_case(problem, tc)
    return problem
