"""
Unit tests for raw problem statement parser.
"""

from problem_engine.problem_parser import parse_raw_problems


def test_parse_numbered_list():
    raw = """1. Write a C program to check whether a given number is even or odd.
2. Write a C program to check whether a given number is positive, negative, or zero.
3. Write a C program to find the largest of three numbers.
"""
    problems = parse_raw_problems(raw)
    assert len(problems) == 3
    assert problems[0].problem_id == "P1"
    assert "even or odd" in problems[0].statement.lower()
    assert problems[1].problem_id == "P2"
    assert "positive, negative, or zero" in problems[1].statement.lower()
    assert problems[2].problem_id == "P3"
    assert "largest of three" in problems[2].statement.lower()


def test_parse_alternate_header_styles():
    raw = """P1: Write a program to calculate factorial.
Problem 2. Write a program to swap two variables.
3) Write a program to reverse an array.
"""
    problems = parse_raw_problems(raw)
    assert len(problems) == 3
    assert problems[0].problem_id == "P1"
    assert "factorial" in problems[0].statement
    assert problems[1].problem_id == "P2"
    assert "swap" in problems[1].statement
    assert problems[2].problem_id == "P3"
    assert "reverse" in problems[2].statement


def test_multiline_statement_preservation():
    raw = """1. Write a menu-driven calculator in C.
Options:
1: Add
2: Subtract
3: Multiply
4: Divide
Handle divide by zero.

2. Check leap year.
Century years must be divisible by 400.
"""
    problems = parse_raw_problems(raw)
    assert len(problems) == 2
    assert "Handle divide by zero." in problems[0].statement
    assert "1: Add" in problems[0].statement
    assert problems[0].original_statement == problems[0].statement
    assert "Century years must be divisible by 400." in problems[1].statement


def test_empty_input_handling():
    assert parse_raw_problems("") == []
    assert parse_raw_problems("   \n\n  ") == []
