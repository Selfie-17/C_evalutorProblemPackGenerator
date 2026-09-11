"""
Canonical JSON Import, Export, and Sample Builder for Problem Packs.
Enforces Schema Version 1.0, non-destructive round-trip serialization,
and human-friendly validation error diagnostics.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Union
from pydantic import ValidationError

from problem_engine.problem_schema import (
    CURRENT_SCHEMA_VERSION,
    Classification,
    Problem,
    ProblemPack,
    TestCase,
    TestStrategy,
)


def build_sample_problem_pack() -> ProblemPack:
    """
    Build a rich, canonical ProblemPack adhering strictly to Schema Version 1.0.
    Includes Even/Odd (P1) and Largest of Three (P2) with reference solutions and test cases.
    """
    p1 = Problem(
        problem_id="P1",
        title="Even or Odd Number Checker",
        statement=(
            "Write a C program that reads an integer from standard input and determines whether it is even or odd.\n"
            "Print 'Even' if the number is even, and 'Odd' if the number is odd."
        ),
        original_statement="1. Write a C program to check whether a given number is even or odd.",
        requirements=[
            "Read a single 32-bit signed integer from standard input.",
            "Output 'Even' if the integer is divisible by 2 with no remainder.",
            "Output 'Odd' otherwise.",
            "Print a trailing newline character.",
        ],
        concepts=["modulo arithmetic", "conditional branching", "integer I/O"],
        constraints=["-10^9 <= n <= 10^9", "Must handle 0 as Even", "Must handle negative integers"],
        classification=Classification(
            category="conditional",
            difficulty="easy",
            required_constructs=["if-else", "%"],
        ),
        test_strategy=TestStrategy(
            base_cases=2,
            boundary_cases=2,
            edge_cases=2,
            failing_cases=0,
            special_cases=1,
            stress_cases=1,
            metamorphic_cases=0,
        ),
        reference_solution_c=(
            "#include <stdio.h>\n\n"
            "int main() {\n"
            "    long long n;\n"
            "    if (scanf(\"%lld\", &n) == 1) {\n"
            "        if (n % 2 == 0) {\n"
            "            printf(\"Even\\n\");\n"
            "        } else {\n"
            "            printf(\"Odd\\n\");\n"
            "        }\n"
            "    }\n"
            "    return 0;\n"
            "}\n"
        ),
        division_approved=True,
        test_cases=[
            TestCase(
                test_id="P1-T01",
                category="base",
                input="4\n",
                expected_output="Even\n",
                reason="Positive even integer",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: 4 is Even",
            ),
            TestCase(
                test_id="P1-T02",
                category="base",
                input="7\n",
                expected_output="Odd\n",
                reason="Positive odd integer",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: 7 is Odd",
            ),
            TestCase(
                test_id="P1-T03",
                category="boundary",
                input="0\n",
                expected_output="Even\n",
                reason="Zero boundary value",
                severity="critical",
                validation_status="passed",
                validation_notes="Validated: 0 is Even",
            ),
            TestCase(
                test_id="P1-T04",
                category="edge",
                input="-8\n",
                expected_output="Even\n",
                reason="Negative even integer",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: -8 is Even",
            ),
            TestCase(
                test_id="P1-T05",
                category="edge",
                input="-15\n",
                expected_output="Odd\n",
                reason="Negative odd integer",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: -15 is Odd",
            ),
            TestCase(
                test_id="P1-T06",
                category="stress",
                input="1000000000\n",
                expected_output="Even\n",
                reason="Large positive even limit",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: 1000000000 is Even",
            ),
            TestCase(
                test_id="P1-T07",
                category="special",
                input="1\n",
                expected_output="Odd\n",
                reason="Smallest positive non-zero odd integer",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: 1 is Odd",
            ),
        ],
    )

    p2 = Problem(
        problem_id="P2",
        title="Largest of Three Integers",
        statement=(
            "Write a C program that reads three space-separated integers a, b, and c from standard input\n"
            "and prints the maximum value among them."
        ),
        original_statement="2. Write a C program to find the largest of three numbers.",
        requirements=[
            "Read three space-separated integers.",
            "Determine the largest value using relational operators or ternary operator.",
            "Print only the maximum integer followed by a newline.",
        ],
        concepts=["relational operators", "nested conditionals", "maximum finding"],
        constraints=["-10^9 <= a, b, c <= 10^9", "Handles identical numbers correctly"],
        classification=Classification(
            category="conditional",
            difficulty="easy",
            required_constructs=["if-else", "relational operators"],
        ),
        test_strategy=TestStrategy(
            base_cases=3,
            boundary_cases=2,
            edge_cases=2,
            failing_cases=0,
            special_cases=1,
            stress_cases=0,
            metamorphic_cases=1,
        ),
        reference_solution_c=(
            "#include <stdio.h>\n\n"
            "int main() {\n"
            "    long long a, b, c;\n"
            "    if (scanf(\"%lld %lld %lld\", &a, &b, &c) == 3) {\n"
            "        long long max_val = a;\n"
            "        if (b > max_val) max_val = b;\n"
            "        if (c > max_val) max_val = c;\n"
            "        printf(\"%lld\\n\", max_val);\n"
            "    }\n"
            "    return 0;\n"
            "}\n"
        ),
        division_approved=True,
        test_cases=[
            TestCase(
                test_id="P2-T01",
                category="base",
                input="10 25 15\n",
                expected_output="25\n",
                reason="Middle number is the largest",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: max(10, 25, 15) = 25",
            ),
            TestCase(
                test_id="P2-T02",
                category="base",
                input="30 10 20\n",
                expected_output="30\n",
                reason="First number is the largest",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: max(30, 10, 20) = 30",
            ),
            TestCase(
                test_id="P2-T03",
                category="base",
                input="10 20 40\n",
                expected_output="40\n",
                reason="Third number is the largest",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: max(10, 20, 40) = 40",
            ),
            TestCase(
                test_id="P2-T04",
                category="boundary",
                input="5 5 2\n",
                expected_output="5\n",
                reason="Two equal largest values",
                severity="critical",
                validation_status="passed",
                validation_notes="Validated: max(5, 5, 2) = 5",
            ),
            TestCase(
                test_id="P2-T05",
                category="special",
                input="9 9 9\n",
                expected_output="9\n",
                reason="All three numbers equal",
                severity="critical",
                validation_status="passed",
                validation_notes="Validated: max(9, 9, 9) = 9",
            ),
            TestCase(
                test_id="P2-T06",
                category="edge",
                input="-10 -5 -20\n",
                expected_output="-5\n",
                reason="All negative integers",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: max(-10, -5, -20) = -5",
            ),
            TestCase(
                test_id="P2-T07",
                category="metamorphic",
                input="100 200 150\n",
                expected_output="200\n",
                reason="Permutation invariance test",
                severity="normal",
                validation_status="passed",
                validation_notes="Validated: max(100, 200, 150) = 200",
            ),
        ],
    )

    pack = ProblemPack(
        schema_version=CURRENT_SCHEMA_VERSION,
        problem_pack_id="sample-pack-01",
        title="Foundational C Programming Laboratory Pack",
        language="C",
        total_problems=2,
        problems=[p1, p2],
        generation_status="generated",
    )
    return pack


def export_problem_pack_json(
    pack: ProblemPack,
    file_path_or_indent: Union[int, str, Path, None] = 2,
    indent: int = 2,
) -> str:
    """
    Export a ProblemPack instance into canonical JSON string.
    If a file path (str or Path) is provided, writes the canonical JSON to that file.
    Preserves all fields, ordering, and test cases.
    """
    pack.total_problems = len(pack.problems)
    data = pack.model_dump()
    target_path = None
    target_indent = indent
    if isinstance(file_path_or_indent, (str, Path)):
        target_path = Path(file_path_or_indent)
    elif isinstance(file_path_or_indent, int):
        target_indent = file_path_or_indent

    res = json.dumps(data, indent=target_indent)
    if target_path:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(res, encoding="utf-8")
    return res


def build_sample_single_problem() -> Problem:
    """Build a canonical single Problem instance adhering strictly to Schema Version 1.0."""
    return Problem(
        problem_id="P1",
        title="Even or Odd Number Checker",
        statement=(
            "Write a C program that reads an integer from standard input and determines whether it is even or odd.\n"
            "Print 'Even' if the number is even, and 'Odd' if the number is odd."
        ),
        original_statement="1. Write a C program to check whether a given number is even or odd.",
        requirements=[
            "Read a single 32-bit signed integer from standard input.",
            "Output 'Even' if the integer is divisible by 2 with no remainder.",
            "Output 'Odd' otherwise.",
            "Print a trailing newline character.",
        ],
        concepts=["modulo arithmetic", "conditional branching", "integer I/O"],
        constraints=["-10^9 <= n <= 10^9", "Must handle 0 as Even", "Must handle negative integers"],
        classification=Classification(
            category="conditional",
            difficulty="easy",
            required_constructs=["if-else", "%"],
        ),
        test_strategy=TestStrategy(
            base_cases=2,
            boundary_cases=2,
            edge_cases=2,
            failing_cases=0,
            special_cases=1,
            stress_cases=1,
            metamorphic_cases=0,
        ),
        reference_solution_c=(
            "#include <stdio.h>\n\n"
            "int main() {\n"
            "    long long n;\n"
            "    if (scanf(\"%lld\", &n) != 1) return 0;\n"
            "    if (n % 2 == 0) {\n"
            "        printf(\"Even\\n\");\n"
            "    } else {\n"
            "        printf(\"Odd\\n\");\n"
            "    }\n"
            "    return 0;\n"
            "}\n"
        ),
        test_cases=[
            TestCase(test_id="P1-T01", category="base", input="4\n", expected_output="Even\n", reason="Positive even integer", validation_status="passed"),
            TestCase(test_id="P1-T02", category="base", input="7\n", expected_output="Odd\n", reason="Positive odd integer", validation_status="passed"),
            TestCase(test_id="P1-T03", category="boundary", input="0\n", expected_output="Even\n", reason="Zero boundary (0 is even)", severity="critical", validation_status="passed"),
            TestCase(test_id="P1-T04", category="edge", input="-8\n", expected_output="Even\n", reason="Negative even integer", validation_status="passed"),
            TestCase(test_id="P1-T05", category="edge", input="-15\n", expected_output="Odd\n", reason="Negative odd integer", validation_status="passed"),
        ],
        division_approved=True,
    )


def import_problem_pack_json(raw_json: Union[str, Dict[str, Any], List[Any]]) -> ProblemPack:
    """
    Parse and validate raw JSON into a ProblemPack instance.
    Supports:
    1. Full ProblemPack JSON (schema_version 1.0, list of problems).
    2. Single Problem JSON (dictionary with 'statement' or 'problem_id').
    3. List of Problems JSON (array of problem objects).
    Produces actionable, exact error diagnostics if schema validation fails.
    """
    if isinstance(raw_json, str):
        try:
            data = json.loads(raw_json)
        except json.JSONDecodeError as err:
            raise ValueError(f"Invalid JSON syntax: {err.msg} at line {err.lineno} col {err.colno}")
    elif isinstance(raw_json, (dict, list)):
        data = raw_json
    else:
        raise ValueError(f"Expected JSON string, dictionary, or list, got {type(raw_json).__name__}")

    # Case A: List of Problem objects [ {...}, {...} ]
    if isinstance(data, list):
        parsed_problems = []
        for idx, item in enumerate(data, start=1):
            if not isinstance(item, dict):
                raise ValueError(f"Problem item #{idx} must be a JSON object, got {type(item).__name__}")
            if "problem_id" not in item:
                item["problem_id"] = f"P{idx}"
            if "statement" not in item and "title" in item:
                item["statement"] = item["title"]
            try:
                prob = Problem.model_validate(item)
                parsed_problems.append(prob)
            except ValidationError as err:
                raise ValueError(f"Problem #{idx} validation error: {err.errors()[0].get('msg', 'invalid')}")

        return ProblemPack(
            schema_version=CURRENT_SCHEMA_VERSION,
            problem_pack_id="imported-problems",
            title="Imported Questions Pack",
            language="C",
            total_problems=len(parsed_problems),
            problems=parsed_problems,
            generation_status="generated" if any(p.test_cases for p in parsed_problems) else "parsed",
        )

    # Case B: Single Problem object { "statement": "...", ... } without "problems" array
    if isinstance(data, dict) and "problems" not in data:
        if "statement" not in data and "title" not in data:
            raise ValueError("Single problem JSON must contain at least a 'statement' or 'title' field.")
        if "problem_id" not in data:
            data["problem_id"] = "P1"
        if "statement" not in data and "title" in data:
            data["statement"] = data["title"]
        try:
            problem = Problem.model_validate(data)
            return ProblemPack(
                schema_version=CURRENT_SCHEMA_VERSION,
                problem_pack_id=f"pack-{problem.problem_id.lower()}",
                title=problem.title or "Single Problem Pack",
                language="C",
                total_problems=1,
                problems=[problem],
                generation_status="generated" if problem.test_cases else "parsed",
            )
        except ValidationError as val_err:
            first_err = val_err.errors()[0]
            raise ValueError(f"Single Problem schema error: {first_err.get('msg', 'validation error')}")

    # Case C: Full ProblemPack object
    if "schema_version" not in data:
        raise ValueError("Missing 'schema_version' field in ProblemPack JSON. Expected '1.0'.")
    version = data.get("schema_version")
    if not str(version).startswith("1."):
        raise ValueError(f"Unsupported schema_version '{version}'. Only version 1.x is supported.")

    try:
        pack = ProblemPack.model_validate(data)
        pack.total_problems = len(pack.problems)
        return pack
    except ValidationError as val_err:
        error_lines = []
        for err in val_err.errors():
            loc = " -> ".join(str(elem) for elem in err.get("loc", []))
            msg = err.get("msg", "Validation error")
            error_lines.append(f"Field '{loc}': {msg}")
        formatted = "; ".join(error_lines[:5])
        if len(error_lines) > 5:
            formatted += f" (and {len(error_lines) - 5} more issues)"
        raise ValueError(f"ProblemPack schema validation failed: {formatted}")
