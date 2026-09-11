"""
AI Test Case Generator supporting Dual Models (Local Qwen 2.5 Coder & Google Gemini Flash)
with Configurable Test Case Counts (10, 25, 50+) and Algorithmic Expansion.
Every test case is deterministically validated via Python before returning.
"""

import json
import logging
import math
from typing import Any, Dict, List, Optional
import httpx

from app.config import (
    DEFAULT_LLM_MODEL,
    GEMINI_API_KEY,
    LLM_TIMEOUT_SECONDS,
    OLLAMA_BASE_URL,
    OLLAMA_NUM_GPU,
    VIVA_GEMINI_MODEL,
)
from problem_engine.problem_schema import Problem, ProblemPack, TestCase
from problem_engine.test_case_validator import validate_test_case

logger = logging.getLogger(__name__)


# ==============================================================================
# Algorithmic 50+ Test Case Synthesizers
# ==============================================================================

def _generate_even_odd_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, val: int, reason: str, sev: str = "normal"):
        nonlocal idx
        expected = "Even\n" if val % 2 == 0 else "Odd\n"
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{val}\n",
                expected_output=expected,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    # Base cases (10)
    for v in [2, 4, 6, 8, 10, 3, 5, 7, 9, 11]:
        add("base", v, f"Standard positive integer {v}")

    # Boundary cases (5)
    add("boundary", 0, "Zero boundary condition (0 is even)", "critical")
    add("boundary", 1, "Immediate positive odd boundary above zero", "critical")
    add("boundary", -1, "Immediate negative odd boundary below zero", "critical")
    add("boundary", 2, "Smallest positive non-zero even integer", "normal")
    add("boundary", -2, "Smallest negative even integer", "normal")

    # Edge cases (negatives) (10)
    for v in [-4, -6, -8, -10, -12, -3, -5, -7, -9, -15]:
        add("edge", v, f"Negative integer {v}")

    # Stress cases (large integers) (10)
    stress_vals = [
        1000000, 1000001, 100000000, 100000001,
        -1000000, -1000001, -100000000, -100000001,
        2147483646, 2147483647
    ]
    for v in stress_vals:
        add("stress", v, f"Large 32-bit integer magnitude {v}")

    # Special / Metamorphic (powers of 2, consecutive pairs) (15+)
    for p in range(1, 16):
        pow2 = 1 << p
        add("special", pow2, f"Power of two (2^{p} = {pow2}) is even")

    while len(cases) < target:
        v = idx * 17
        add("metamorphic", v, f"Synthetic pseudo-random integer {v}")

    return cases[:target]


def _generate_largest_of_three_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, a: int, b: int, c: int, reason: str, sev: str = "normal"):
        nonlocal idx
        max_val = max(a, b, c)
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{a} {b} {c}\n",
                expected_output=f"{max_val}\n",
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    # Base permutations (15)
    base_triplets = [
        (10, 20, 30), (30, 20, 10), (20, 30, 10), (10, 30, 20), (20, 10, 30),
        (5, 15, 25), (25, 15, 5), (15, 25, 5), (5, 25, 15), (15, 5, 25),
        (100, 200, 300), (300, 100, 200), (200, 300, 100), (7, 14, 21), (21, 7, 14)
    ]
    for a, b, c in base_triplets:
        add("base", a, b, c, f"Standard permutation max({a},{b},{c})")

    # Boundary: equality cases (10)
    add("boundary", 5, 5, 2, "First two equal and largest", "critical")
    add("boundary", 2, 5, 5, "Last two equal and largest", "critical")
    add("boundary", 5, 2, 5, "First and last equal and largest", "critical")
    add("boundary", 5, 5, 8, "First two equal, third strictly largest", "normal")
    add("boundary", 8, 5, 5, "Last two equal, first strictly largest", "normal")
    add("boundary", 0, 0, 0, "All zeroes", "critical")
    add("boundary", 0, 0, 5, "Two zeroes and one positive", "normal")
    add("boundary", -5, 0, 0, "Two zeroes and one negative", "normal")
    add("boundary", 0, 5, 0, "Zeroes on ends with positive center", "normal")
    add("boundary", 1, 1, 1, "All ones", "normal")

    # Edge: all negative integers (10)
    neg_triplets = [
        (-10, -20, -30), (-30, -20, -10), (-20, -10, -30), (-5, -5, -2), (-2, -5, -5),
        (-100, -50, -75), (-1, -2, -3), (-3, -1, -2), (-999, -998, -997), (-15, -15, -15)
    ]
    for a, b, c in neg_triplets:
        add("edge", a, b, c, f"All negative integers max({a},{b},{c})")

    # Stress: 32-bit limits (10)
    stress_triplets = [
        (2147483647, 0, -1), (0, 2147483647, 1000), (1000, 2000, 2147483647),
        (-2147483648, -100, 0), (0, -2147483648, -500), (-1000000, 1000000, 500000),
        (1000000000, 999999999, 1000000001), (-1000000000, -999999999, -1000000001),
        (500000000, 500000000, 499999999), (2147483646, 2147483647, 2147483645)
    ]
    for a, b, c in stress_triplets:
        add("stress", a, b, c, f"Large 32-bit values max({a},{b},{c})")

    # Metamorphic permutations (10+)
    while len(cases) < target:
        n = idx * 13
        add("metamorphic", n, n * 2, n - 5, f"Metamorphic permutation triplet ({n}, {n*2}, {n-5})")

    return cases[:target]


def _generate_leap_year_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, y: int, reason: str, sev: str = "normal"):
        nonlocal idx
        is_leap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0)
        expected = "Leap Year\n" if is_leap else "Not Leap Year\n"
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{y}\n",
                expected_output=expected,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    # Special quad-century leap years (divisible by 400)
    for y in [1600, 2000, 2400, 2800, 1200, 800, 400]:
        add("special", y, f"Quad-century year {y} (divisible by 400) is Leap", "critical")

    # Failing/Special century non-leap years (divisible by 100, not 400)
    for y in [1700, 1800, 1900, 2100, 2200, 2300, 2500, 2600, 2700, 1500, 1400, 1300]:
        add("failing", y, f"Century year {y} divisible by 100 but not 400 is NOT Leap", "critical")

    # Standard leap years (divisible by 4, not 100)
    for y in [1996, 2004, 2008, 2012, 2016, 2020, 2024, 2028, 2032, 2036, 2040, 1984, 1988, 1992]:
        add("base", y, f"Standard leap year {y} divisible by 4")

    # Standard non-leap odd years
    for y in [2021, 2023, 2025, 2027, 2029, 2031, 2033, 1999, 1997, 1995, 1993, 2001]:
        add("base", y, f"Standard odd year {y} is NOT Leap")

    # Non-leap even years (not divisible by 4)
    for y in [2002, 2006, 2010, 2014, 2018, 2022, 2026, 2030, 1998, 1994]:
        add("boundary", y, f"Even year {y} not divisible by 4 is NOT Leap")

    # Boundary & stress
    while len(cases) < target:
        y = 2040 + (idx * 4)
        add("stress", y, f"Future leap year check {y}")

    return cases[:target]


def _generate_perfect_square_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, n: int, reason: str, sev: str = "normal"):
        nonlocal idx
        is_sq = False
        if n >= 0:
            r = int(math.isqrt(n))
            is_sq = (r * r == n)
        expected = "Perfect Square\n" if is_sq else "Not Perfect Square\n"
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{n}\n",
                expected_output=expected,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    # Boundaries
    add("boundary", 0, "Zero boundary: 0^2 = 0 is a perfect square", "critical")
    add("boundary", 1, "One boundary: 1^2 = 1 is a perfect square", "critical")
    add("boundary", 2, "Immediate non-square above 1", "normal")
    add("boundary", 3, "Non-square just below 4", "normal")
    add("boundary", 4, "2^2 = 4 is a perfect square", "normal")

    # True squares (20)
    for i in range(3, 23):
        add("base", i * i, f"Square of {i}: {i}^2 = {i*i}")

    # Non-squares near-misses (15)
    for i in range(5, 20):
        add("edge", (i * i) - 1, f"Near-miss below square: ({i}^2)-1 = {(i*i)-1}")
        add("edge", (i * i) + 1, f"Near-miss above square: ({i}^2)+1 = {(i*i)+1}")

    # Negative numbers (cannot be squares in real integers) (8)
    for n in [-1, -4, -9, -16, -25, -100, -1000, -2147483648]:
        add("edge", n, f"Negative number {n} is never a real square", "critical")

    while len(cases) < target:
        n = (idx + 25) ** 2
        add("stress", n, f"Large square {(idx+25)}^2 = {n}")

    return cases[:target]


def _generate_pos_neg_zero_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, val: int, reason: str, sev: str = "normal"):
        nonlocal idx
        exp = "Positive\n" if val > 0 else ("Negative\n" if val < 0 else "Zero\n")
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{val}\n",
                expected_output=exp,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    add("boundary", 0, "Zero boundary: neither positive nor negative", "critical")
    add("boundary", 1, "Smallest positive integer boundary", "normal")
    add("boundary", -1, "Largest negative integer boundary", "normal")

    for v in [5, 10, 25, 42, 100, 999, 1234, 5000, 10000, 2147483647]:
        add("base", v, f"Standard positive integer {v}")

    for v in [-5, -10, -25, -42, -100, -999, -1234, -5000, -10000, -2147483648]:
        add("edge", v, f"Standard negative integer {v}")

    while len(cases) < target:
        v = idx * 17 if idx % 2 == 0 else -idx * 19
        add("stress", v, f"Generated integer {v}")

    return cases[:target]


def _generate_character_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, ch: str, reason: str, sev: str = "normal"):
        nonlocal idx
        if ch.isupper():
            exp = "Uppercase letter\n"
        elif ch.islower():
            exp = "Lowercase letter\n"
        elif ch.isdigit():
            exp = "Digit\n"
        else:
            exp = "Special character\n"
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{ch}\n",
                expected_output=exp,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    # Boundaries
    add("boundary", "A", "Start of uppercase alphabet boundary", "critical")
    add("boundary", "Z", "End of uppercase alphabet boundary", "critical")
    add("boundary", "a", "Start of lowercase alphabet boundary", "critical")
    add("boundary", "z", "End of lowercase alphabet boundary", "critical")
    add("boundary", "0", "Start of digit range boundary", "critical")
    add("boundary", "9", "End of digit range boundary", "critical")

    # Base letters
    for c in ["B", "M", "Q", "e", "k", "p", "3", "5", "7"]:
        add("base", c, f"Character classification for '{c}'")

    # Specials
    for s in ["@", "#", "$", "%", "&", "*", "!", "?", "+", "-", "/", "=", "[", "]", ";", ":", "<", ">"]:
        add("special", s, f"Special symbol classification for '{s}'")

    while len(cases) < target:
        ch = chr(33 + (idx % 93))
        add("stress", ch, f"Extended ASCII character '{ch}'")

    return cases[:target]


def _generate_sizeof_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    exp = "sizeof(char) = 1 byte\nsizeof(short) = 2 bytes\nsizeof(int) = 4 bytes\nsizeof(long) = 4 bytes\nsizeof(float) = 4 bytes\nsizeof(double) = 8 bytes\n"
    cases.append(TestCase(test_id=f"{pid}-T01", category="base", input="\n", expected_output=exp, reason="Standard C fundamental data type memory allocation", severity="critical"))
    cases.append(TestCase(test_id=f"{pid}-T02", category="boundary", input=" \n", expected_output=exp, reason="Whitespace standard stream execution", severity="normal"))
    for idx in range(3, target + 1):
        cases.append(TestCase(test_id=f"{pid}-T{idx:02d}", category="special", input="\n", expected_output=exp, reason=f"Repetitive type size integrity check run {idx}", severity="normal"))
    return cases[:target]


def _generate_menu_calc_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, choice: int, a: int, b: int, reason: str, sev: str = "normal"):
        nonlocal idx
        if choice == 1:
            res = a + b
        elif choice == 2:
            res = a - b
        elif choice == 3:
            res = a * b
        elif choice == 4:
            res = a // b if b != 0 else 0
        elif choice == 5:
            res = a % b if b != 0 else 0
        elif choice == 6:
            res = a ** b if 0 <= b <= 10 else 0
        else:
            res = 0
        exp = f"Result: {res}\n"
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{choice} {a} {b}\n",
                expected_output=exp,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    add("base", 1, 10, 20, "Addition: 10 + 20 = 30")
    add("base", 2, 50, 18, "Subtraction: 50 - 18 = 32")
    add("base", 3, 7, 8, "Multiplication: 7 * 8 = 56")
    add("base", 4, 40, 5, "Division: 40 / 5 = 8")
    add("base", 5, 29, 6, "Modulus: 29 % 6 = 5")
    add("base", 6, 2, 5, "Power: 2 ^ 5 = 32")
    add("boundary", 1, 0, 0, "Addition with zeros: 0 + 0 = 0")
    add("boundary", 2, 0, 15, "Subtraction with zero: 0 - 15 = -15")
    add("boundary", 3, 0, 100, "Multiplication by zero: 0 * 100 = 0")
    add("edge", 1, -15, 25, "Addition with negative: -15 + 25 = 10")
    add("edge", 2, -10, -30, "Subtraction with negatives: -10 - (-30) = 20")

    while len(cases) < target:
        ch = (idx % 6) + 1
        a, b = idx * 3, (idx % 9) + 1
        add("stress", ch, a, b, f"Menu operation {ch} on {a}, {b}")

    return cases[:target]


def _generate_swap_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, a: int, b: int, reason: str, sev: str = "normal"):
        nonlocal idx
        exp = f"After swap: a = {b}, b = {a}\n"
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{a} {b}\n",
                expected_output=exp,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    add("base", 10, 20, "Swap two distinct positive numbers", "normal")
    add("base", 5, 99, "Swap small and large numbers", "normal")
    add("boundary", 0, 50, "Swap zero and non-zero", "critical")
    add("boundary", 0, 0, "Swap two zeros", "critical")
    add("boundary", 42, 42, "Swap identical numbers", "normal")
    add("edge", -10, 20, "Swap negative and positive numbers", "normal")
    add("edge", -35, -70, "Swap two negative numbers", "normal")

    while len(cases) < target:
        a = (idx * 11) - 50
        b = (idx * 23) - 100
        add("stress", a, b, f"Swap test values {a} and {b}")

    return cases[:target]


def _generate_student_grade_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1

    def add(cat: str, marks: int, reason: str, sev: str = "normal"):
        nonlocal idx
        if marks >= 90:
            g = "Grade A\n"
        elif marks >= 80:
            g = "Grade B\n"
        elif marks >= 70:
            g = "Grade C\n"
        elif marks >= 60:
            g = "Grade D\n"
        else:
            g = "Grade F\n"
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{marks}\n",
                expected_output=g,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    add("boundary", 100, "Maximum score boundary (100) -> Grade A", "critical")
    add("boundary", 90, "Grade A lower threshold boundary (90)", "critical")
    add("boundary", 89, "Grade B upper threshold boundary (89)", "critical")
    add("boundary", 80, "Grade B lower threshold boundary (80)", "critical")
    add("boundary", 79, "Grade C upper threshold boundary (79)", "critical")
    add("boundary", 70, "Grade C lower threshold boundary (70)", "critical")
    add("boundary", 60, "Grade D lower threshold boundary (60)", "critical")
    add("boundary", 59, "Failing threshold boundary (59)", "critical")
    add("boundary", 0, "Minimum score boundary (0) -> Grade F", "critical")

    for m in [95, 92, 85, 82, 75, 72, 65, 62, 50, 40, 25]:
        add("base", m, f"Standard score {m}")

    while len(cases) < target:
        m = (idx * 37) % 101
        add("stress", m, f"Randomized student mark {m}")

    return cases[:target]


def _generate_extended_calc_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases = _generate_menu_calc_50_cases(pid, 30)
    idx = len(cases) + 1

    def add_special(cat: str, inp: str, exp: str, reason: str, sev: str = "critical"):
        nonlocal idx
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=inp,
                expected_output=exp,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    add_special("failing", "4 25 0\n", "Error: Division by zero\n", "Division by zero handling", "critical")
    add_special("failing", "5 10 0\n", "Error: Modulus by zero\n", "Modulus by zero handling", "critical")
    add_special("failing", "4 -50 0\n", "Error: Division by zero\n", "Negative numerator division by zero", "critical")
    add_special("failing", "7 10 20\n", "Invalid choice\n", "Menu choice 7 exceeds range 1-6", "critical")
    add_special("failing", "0 10 20\n", "Invalid choice\n", "Menu choice 0 is invalid", "critical")
    add_special("failing", "-1 5 5\n", "Invalid choice\n", "Negative menu choice is invalid", "critical")
    add_special("failing", "99 10 10\n", "Invalid choice\n", "Menu choice 99 is invalid", "critical")

    while len(cases) < target:
        add_special("failing", f"{100+idx} 1 1\n", "Invalid choice\n", f"Invalid menu choice {100+idx}")

    return cases[:target]


def _generate_grade_point_50_cases(pid: str, target: int = 50) -> List[TestCase]:
    cases: List[TestCase] = []
    idx = 1
    mapping = {10: "Grade O\n", 9: "Grade A\n", 8: "Grade B\n", 7: "Grade C\n", 6: "Grade D\n", 5: "Grade P\n"}

    def add(cat: str, pt: int, reason: str, sev: str = "normal"):
        nonlocal idx
        exp = mapping.get(pt, "Grade F\n")
        cases.append(
            TestCase(
                test_id=f"{pid}-T{idx:02d}",
                category=cat,  # type: ignore
                input=f"{pt}\n",
                expected_output=exp,
                reason=reason,
                severity=sev,  # type: ignore
            )
        )
        idx += 1

    for pt in [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]:
        add("base" if pt >= 5 else "boundary", pt, f"Grade point {pt} conversion", "critical" if pt in [10, 5, 4, 0] else "normal")

    while len(cases) < target:
        pt = (idx % 11)
        add("stress", pt, f"Grade point cycle {pt}")

    return cases[:target]


def _synthesize_50_plus_cases(problem: Problem, target_count: int = 50) -> List[TestCase]:
    """
    Synthesize high-coverage, verified 50+ test cases for common C lab curriculum patterns.
    """
    s_lower = problem.statement.lower() + " " + problem.title.lower()
    pid = problem.problem_id

    if "sizeof" in s_lower or "memory allocation" in s_lower or "data types" in s_lower:
        return _generate_sizeof_50_cases(pid, target_count)
    if "extended" in s_lower and "calculator" in s_lower:
        return _generate_extended_calc_50_cases(pid, target_count)
    if "menu" in s_lower and ("calculator" in s_lower or "program" in s_lower or "addition" in s_lower):
        return _generate_menu_calc_50_cases(pid, target_count)
    if "swap" in s_lower:
        return _generate_swap_50_cases(pid, target_count)
    if "grade point" in s_lower or ("letter grade" in s_lower and "switch" in s_lower):
        return _generate_grade_point_50_cases(pid, target_count)
    if "grade" in s_lower and "marks" in s_lower:
        return _generate_student_grade_50_cases(pid, target_count)
    if "character" in s_lower or "uppercase" in s_lower or "letter" in s_lower:
        return _generate_character_50_cases(pid, target_count)
    if "positive" in s_lower and "negative" in s_lower:
        return _generate_pos_neg_zero_50_cases(pid, target_count)
    if "even" in s_lower and "odd" in s_lower:
        return _generate_even_odd_50_cases(pid, target_count)
    if "largest" in s_lower or "greatest" in s_lower or "maximum" in s_lower:
        return _generate_largest_of_three_50_cases(pid, target_count)
    if "leap" in s_lower and "year" in s_lower:
        return _generate_leap_year_50_cases(pid, target_count)
    if "perfect square" in s_lower or ("square" in s_lower and "sqrt" in s_lower):
        return _generate_perfect_square_50_cases(pid, target_count)

    return []


# ==============================================================================
# Model Providers: Qwen & Gemini
# ==============================================================================

def _normalize_category(cat: Any) -> str:
    cat_clean = str(cat or "base").lower().strip()
    if cat_clean in ["base", "boundary", "edge", "failing", "invalid_input", "special", "stress", "metamorphic"]:
        return cat_clean
    if "bound" in cat_clean:
        return "boundary"
    if "fail" in cat_clean or "invalid" in cat_clean:
        return "failing"
    if "edge" in cat_clean:
        return "edge"
    if "special" in cat_clean:
        return "special"
    if "stress" in cat_clean:
        return "stress"
    if "meta" in cat_clean:
        return "metamorphic"
    return "base"


def _normalize_severity(sev: Any) -> str:
    sev_clean = str(sev or "normal").lower().strip()
    if sev_clean in ["normal", "critical", "optional"]:
        return sev_clean
    if sev_clean in ["high", "crit", "critical", "urgent", "must"]:
        return "critical"
    if sev_clean in ["low", "opt", "optional", "bonus", "minor"]:
        return "optional"
    return "normal"


async def _generate_with_qwen(problem: Problem, target_count: int) -> List[TestCase]:
    """Generate test cases using local Ollama Qwen 2.5 Coder 3B."""
    pid = problem.problem_id
    num_to_req = min(target_count, 6)
    prompt = f"""You are an expert C programming test engineer.
Generate {num_to_req} high-quality test cases partitioned across categories (base, boundary, edge, failing, special).

PROBLEM ID: {problem.problem_id}
TITLE: {problem.title}
STATEMENT:
\"\"\"{problem.statement}\"\"\"

REQUIREMENTS:
{json.dumps(problem.requirements)}

CONSTRAINTS:
{json.dumps(problem.constraints)}

Return ONLY a valid JSON object matching this schema:
{{
  "test_cases": [
    {{
      "test_id": "{pid}-T01",
      "category": "base",
      "input": "exact stdin string with newline",
      "expected_output": "exact expected stdout string with newline",
      "reason": "Explanation of what this case tests",
      "severity": "normal"
    }}
  ]
}}
"""

    client_timeout = httpx.Timeout(LLM_TIMEOUT_SECONDS, connect=2.0)
    try:
        async with httpx.AsyncClient(timeout=client_timeout) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": DEFAULT_LLM_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.1, "num_gpu": OLLAMA_NUM_GPU},
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                raw = data.get("response", "").strip()
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    parsed = parsed.get("test_cases", parsed.get("tests", []))
                if isinstance(parsed, list):
                    result = []
                    for idx, item in enumerate(parsed, start=1):
                        result.append(
                            TestCase(
                                test_id=item.get("test_id", f"{pid}-T{idx:02d}"),
                                category=_normalize_category(item.get("category", "base")),
                                input=str(item.get("input", "")),
                                expected_output=str(item.get("expected_output", "")),
                                reason=item.get("reason", "Automated test case"),
                                severity=_normalize_severity(item.get("severity", "normal")),
                            )
                        )
                    return result
    except Exception as e:
        logger.warning(f"Qwen generation offline or failed: {e}")
    return []


async def _generate_with_gemini(
    problem: Problem,
    target_count: int,
    api_key: Optional[str] = None,
) -> List[TestCase]:
    """Generate comprehensive test cases using Google Gemini API."""
    effective_key = api_key or GEMINI_API_KEY
    if not effective_key:
        raise ValueError("Gemini API key is not configured. Please supply an API key in the UI or .env.")

    pid = problem.problem_id
    target_model = VIVA_GEMINI_MODEL or "gemini-3.8-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={effective_key}"

    prompt = f"""You are an elite automated test generation engineer for C programming curriculum.
Generate {min(target_count, 10)} deterministic test cases for this C lab problem:

PROBLEM ID: {problem.problem_id}
TITLE: {problem.title}
STATEMENT:
\"\"\"{problem.statement}\"\"\"

REQUIREMENTS:
{json.dumps(problem.requirements)}

CONSTRAINTS:
{json.dumps(problem.constraints)}

DISTRIBUTION GUIDELINE FOR {target_count} TEST CASES:
- Base cases: standard valid inputs (~25%)
- Boundary cases: zeros, off-by-one, transition thresholds (~25%)
- Edge cases: negative numbers, duplicates (~20%)
- Special & Failing cases: domain specific checks, error triggers (~15%)
- Stress & Metamorphic cases: large integers, inverted/permuted orders (~15%)

Return ONLY a valid JSON object matching this schema:
{{
  "test_cases": [
    {{
      "test_id": "{pid}-T01",
      "category": "base",
      "input": "exact stdin string with newline",
      "expected_output": "exact expected stdout string with newline",
      "reason": "Educational purpose of this test case",
      "severity": "normal"
    }}
  ]
}}
"""

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    }

    client_timeout = httpx.Timeout(LLM_TIMEOUT_SECONDS, connect=5.0)
    async with httpx.AsyncClient(timeout=client_timeout) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini API returned error {resp.status_code}: {resp.text}")
        data = resp.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)

        if isinstance(parsed, dict):
            parsed = parsed.get("test_cases", parsed.get("tests", []))

        result = []
        if isinstance(parsed, list):
            for idx, item in enumerate(parsed, start=1):
                result.append(
                    TestCase(
                        test_id=item.get("test_id", f"{pid}-T{idx:02d}"),
                        category=_normalize_category(item.get("category", "base")),
                        input=str(item.get("input", "")),
                        expected_output=str(item.get("expected_output", "")),
                        reason=item.get("reason", "Gemini generated test case"),
                        severity=_normalize_severity(item.get("severity", "normal")),
                    )
                )
        return result


# ==============================================================================
# Main Generation Dispatcher
# ==============================================================================

async def generate_problem_test_cases(
    problem: Problem,
    provider: str = "qwen",
    target_count: int = 50,
    gemini_api_key: Optional[str] = None,
) -> List[TestCase]:
    """
    Generate structured test cases for a single problem.
    Supports provider="qwen" (Local Ollama) or provider="gemini" (Google Gemini API).
    Ensures up to target_count test cases (default 50) using algorithmic synthesizers.
    Immediately verifies all generated test cases via deterministic Python validators.
    """
    target = max(5, target_count)
    generated: List[TestCase] = []

    # 1. First, synthesize domain-specific cases with generous padding to satisfy target_count
    synthesized = _synthesize_50_plus_cases(problem, target + 30)

    if provider.lower() == "gemini":
        try:
            logger.info(f"Generating test cases with Gemini API for {problem.problem_id} (target: {target})...")
            gemini_cases = await _generate_with_gemini(problem, target, gemini_api_key)
            if gemini_cases and len(gemini_cases) >= min(15, target):
                generated = gemini_cases
        except Exception as e:
            logger.warning(f"Gemini test case generation failed: {e}. Falling back to synthesizer/Qwen.")

    if not generated:
        # Try Qwen if provider is qwen or gemini failed
        try:
            logger.info(f"Generating test cases with Qwen for {problem.problem_id}...")
            qwen_cases = await _generate_with_qwen(problem, target)
            if qwen_cases:
                generated = qwen_cases
        except Exception as e:
            logger.warning(f"Qwen test case generation failed: {e}.")

    # Deterministically validate every test case and discard any mathematically invalid cases
    validated_cases: List[TestCase] = []
    seen_inputs = set()
    for tc in generated:
        validate_test_case(problem, tc)
        if tc.validation_status != "failed" and tc.input.strip() not in seen_inputs:
            validated_cases.append(tc)
            seen_inputs.add(tc.input.strip())

    # Top up with synthesized cases to ensure target_count is reached
    if synthesized:
        for syn_case in synthesized:
            if len(validated_cases) >= target:
                break
            if syn_case.input.strip() not in seen_inputs:
                validate_test_case(problem, syn_case)
                validated_cases.append(syn_case)
                seen_inputs.add(syn_case.input.strip())

    # Fallback to pure synthesized if still empty
    if not validated_cases and synthesized:
        for syn_case in synthesized[:target]:
            validate_test_case(problem, syn_case)
            validated_cases.append(syn_case)

    # Renumber test IDs cleanly
    for idx, tc in enumerate(validated_cases, start=1):
        tc.test_id = f"{problem.problem_id}-T{idx:02d}"

    problem.test_cases = validated_cases
    return validated_cases


async def generate_pack_test_cases(
    pack: ProblemPack,
    provider: str = "qwen",
    target_count: int = 50,
    gemini_api_key: Optional[str] = None,
) -> ProblemPack:
    """
    Generate test cases sequentially for all problems in the pack.
    Sequential execution avoids overwhelming local GPU VRAM or hitting API rate limits.
    """
    for problem in pack.problems:
        await generate_problem_test_cases(
            problem=problem,
            provider=provider,
            target_count=target_count,
            gemini_api_key=gemini_api_key,
        )

    pack.generation_status = "generated"
    return pack
