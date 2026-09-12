import asyncio
import json
import logging
import re
from typing import List, Optional

from app.config import GEMINI_MODEL

from app.database.db import (
    delete_single_problem,
    delete_week_problems,
    get_week,
    get_week_problems,
    save_problem,
    update_week,
)
from app.models import (
    DifficultyEnum,
    GeneratedProblemSchema,
    GenerateFromQuestionsRequest,
    GeneratePackRequest,
    GeneratePackResponse,
    GenerateProblemRequest,
    GenerateSingleQuestionRequest,
    GenerateSingleQuestionResponse,
    ProblemInPack,
    TestCaseSchema,
    VerificationReport,
)
from app.services.generator import generate_problem_from_llm, verify_reference_solution

logger = logging.getLogger(__name__)

# Curated, pre-verified standard LeetCode-style C programming curriculum problems for instant seeding
SEED_PACKS_BY_WEEK = {
    1: [
        {
            "number": 1,
            "title": "Sum of Two Numbers",
            "slug": "sum-two-numbers",
            "difficulty": "Easy",
            "topics": ["Math", "Basic I/O"],
            "description": "Given two integers a and b from standard input, compute and print their sum.",
            "input_format": "A single line containing two space-separated integers a and b.",
            "output_format": "Print a single integer: the sum of a and b.",
            "constraints": ["-10^9 <= a, b <= 10^9"],
            "hints": ["Use standard scanf with %d %d", "Use int or long long if large"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "10 20\n", "expected_output": "30"},
                {"input": "5 7\n", "expected_output": "12"},
            ],
            "hidden_test_cases": [
                {"input": "-10 15\n", "expected_output": "5"},
                {"input": "0 0\n", "expected_output": "0"},
                {"input": "1000 -500\n", "expected_output": "500"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    long long a, b;\n"
                "    if (scanf(\"%lld %lld\", &a, &b) == 2) {\n        printf(\"%lld\", a + b);\n"
                "    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 2,
            "title": "Check Even or Odd",
            "slug": "even-or-odd",
            "difficulty": "Easy",
            "topics": ["Conditionals", "Math"],
            "description": "Given an integer n from standard input, print 'EVEN' if n is even, and 'ODD' if n is odd.",
            "input_format": "A single integer n.",
            "output_format": "Print 'EVEN' or 'ODD' (in uppercase).",
            "constraints": ["-10^9 <= n <= 10^9"],
            "hints": ["Use modulo operator % 2"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "4\n", "expected_output": "EVEN"},
                {"input": "7\n", "expected_output": "ODD"},
            ],
            "hidden_test_cases": [
                {"input": "0\n", "expected_output": "EVEN"},
                {"input": "-3\n", "expected_output": "ODD"},
                {"input": "-8\n", "expected_output": "EVEN"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    long long n;\n"
                "    if (scanf(\"%lld\", &n) == 1) {\n        if (n % 2 == 0) printf(\"EVEN\");\n"
                "        else printf(\"ODD\");\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 3,
            "title": "Maximum of Three Numbers",
            "slug": "max-of-three",
            "difficulty": "Easy",
            "topics": ["Conditionals"],
            "description": "Given three integers a, b, and c from standard input, determine and print the maximum value.",
            "input_format": "Three space-separated integers a, b, and c.",
            "output_format": "Print the maximum integer among the three.",
            "constraints": ["-10^9 <= a, b, c <= 10^9"],
            "hints": ["Compare a with b and c"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "3 9 5\n", "expected_output": "9"},
                {"input": "12 4 8\n", "expected_output": "12"},
            ],
            "hidden_test_cases": [
                {"input": "1 1 1\n", "expected_output": "1"},
                {"input": "-10 -20 -5\n", "expected_output": "-5"},
                {"input": "0 0 5\n", "expected_output": "5"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    long long a, b, c;\n"
                "    if (scanf(\"%lld %lld %lld\", &a, &b, &c) == 3) {\n"
                "        long long max_val = a;\n"
                "        if (b > max_val) max_val = b;\n"
                "        if (c > max_val) max_val = c;\n"
                "        printf(\"%lld\", max_val);\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 4,
            "title": "Factorial of a Number",
            "slug": "factorial-number",
            "difficulty": "Easy",
            "topics": ["Loops", "Math"],
            "description": "Given a non-negative integer n (0 <= n <= 15), compute and print n factorial (n!).",
            "input_format": "A single integer n.",
            "output_format": "Print n!.",
            "constraints": ["0 <= n <= 15"],
            "hints": ["0! = 1", "Use a for loop from 1 to n"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "5\n", "expected_output": "120"},
                {"input": "0\n", "expected_output": "1"},
            ],
            "hidden_test_cases": [
                {"input": "1\n", "expected_output": "1"},
                {"input": "6\n", "expected_output": "720"},
                {"input": "10\n", "expected_output": "3628800"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    int n;\n"
                "    if (scanf(\"%d\", &n) == 1) {\n        long long fact = 1;\n"
                "        for (int i = 1; i <= n; i++) fact *= i;\n"
                "        printf(\"%lld\", fact);\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 5,
            "title": "Palindrome Number",
            "slug": "palindrome-number",
            "difficulty": "Easy",
            "topics": ["Math", "Conditionals"],
            "description": "Given an integer x, print 1 if x is a palindrome integer, else print 0. Negative numbers are not palindromes.",
            "input_format": "A single integer x.",
            "output_format": "Print 1 if palindrome, otherwise 0.",
            "constraints": ["-2^31 <= x <= 2^31 - 1"],
            "hints": ["Reverse the digits of x and compare with original"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "121\n", "expected_output": "1"},
                {"input": "-121\n", "expected_output": "0"},
            ],
            "hidden_test_cases": [
                {"input": "10\n", "expected_output": "0"},
                {"input": "0\n", "expected_output": "1"},
                {"input": "12321\n", "expected_output": "1"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    long long x;\n"
                "    if (scanf(\"%lld\", &x) == 1) {\n        if (x < 0) { printf(\"0\"); return 0; }\n"
                "        long long orig = x, rev = 0;\n"
                "        while (x > 0) {\n            rev = rev * 10 + (x % 10);\n            x /= 10;\n        }\n"
                "        printf(\"%d\", (orig == rev) ? 1 : 0);\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 6,
            "title": "Sum of Digits",
            "slug": "sum-of-digits",
            "difficulty": "Easy",
            "topics": ["Loops", "Math"],
            "description": "Given a positive integer n, compute and print the sum of its digits.",
            "input_format": "A single positive integer n.",
            "output_format": "Print the sum of digits of n.",
            "constraints": ["1 <= n <= 10^9"],
            "hints": ["Extract last digit using n % 10, then n /= 10 in a while loop"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "1234\n", "expected_output": "10"},
                {"input": "99\n", "expected_output": "18"},
            ],
            "hidden_test_cases": [
                {"input": "5\n", "expected_output": "5"},
                {"input": "100000\n", "expected_output": "1"},
                {"input": "987654321\n", "expected_output": "45"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    long long n;\n"
                "    if (scanf(\"%lld\", &n) == 1) {\n        long long sum = 0;\n"
                "        while (n > 0) {\n            sum += (n % 10);\n            n /= 10;\n        }\n"
                "        printf(\"%lld\", sum);\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 7,
            "title": "Prime Number Check",
            "slug": "prime-number-check",
            "difficulty": "Easy",
            "topics": ["Math", "Loops"],
            "description": "Given an integer n > 1, determine if n is a prime number. Print 'PRIME' if prime, otherwise 'COMPOSITE'.",
            "input_format": "A single integer n.",
            "output_format": "Print 'PRIME' or 'COMPOSITE'.",
            "constraints": ["2 <= n <= 10^7"],
            "hints": ["Check divisors up to sqrt(n)"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "7\n", "expected_output": "PRIME"},
                {"input": "10\n", "expected_output": "COMPOSITE"},
            ],
            "hidden_test_cases": [
                {"input": "2\n", "expected_output": "PRIME"},
                {"input": "97\n", "expected_output": "PRIME"},
                {"input": "100\n", "expected_output": "COMPOSITE"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    long long n;\n"
                "    if (scanf(\"%lld\", &n) == 1) {\n        if (n < 2) { printf(\"COMPOSITE\"); return 0; }\n"
                "        int is_prime = 1;\n"
                "        for (long long i = 2; i * i <= n; i++) {\n"
                "            if (n % i == 0) { is_prime = 0; break; }\n        }\n"
                "        printf(\"%s\", is_prime ? \"PRIME\" : \"COMPOSITE\");\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 8,
            "title": "Nth Fibonacci Number",
            "slug": "nth-fibonacci-number",
            "difficulty": "Easy",
            "topics": ["Loops", "Math"],
            "description": "Given an integer n (0 <= n <= 30), compute the nth Fibonacci number. F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2).",
            "input_format": "A single integer n.",
            "output_format": "Print F(n).",
            "constraints": ["0 <= n <= 30"],
            "hints": ["Use two variables to track F(i-1) and F(i-2) iteratively"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "0\n", "expected_output": "0"},
                {"input": "6\n", "expected_output": "8"},
            ],
            "hidden_test_cases": [
                {"input": "1\n", "expected_output": "1"},
                {"input": "10\n", "expected_output": "55"},
                {"input": "20\n", "expected_output": "6765"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    int n;\n"
                "    if (scanf(\"%d\", &n) == 1) {\n        if (n == 0) { printf(\"0\"); return 0; }\n"
                "        if (n == 1) { printf(\"1\"); return 0; }\n"
                "        long long a = 0, b = 1, c = 0;\n"
                "        for (int i = 2; i <= n; i++) {\n            c = a + b;\n            a = b;\n            b = c;\n        }\n"
                "        printf(\"%lld\", b);\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 9,
            "title": "Array Sum",
            "slug": "array-sum",
            "difficulty": "Easy",
            "topics": ["Arrays", "Loops"],
            "description": "Given an integer n followed by n integers, calculate and print the sum of all elements in the array.",
            "input_format": "First line contains integer n. Second line contains n space-separated integers.",
            "output_format": "Print the sum of the array elements.",
            "constraints": ["1 <= n <= 1000", "-10^6 <= arr[i] <= 10^6"],
            "hints": ["Read n, then loop n times adding elements to sum"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "4\n1 2 3 4\n", "expected_output": "10"},
                {"input": "3\n-5 10 5\n", "expected_output": "10"},
            ],
            "hidden_test_cases": [
                {"input": "1\n100\n", "expected_output": "100"},
                {"input": "5\n0 0 0 0 0\n", "expected_output": "0"},
                {"input": "4\n-1 -2 -3 -4\n", "expected_output": "-10"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    int n;\n"
                "    if (scanf(\"%d\", &n) == 1) {\n        long long sum = 0, val;\n"
                "        for (int i = 0; i < n; i++) {\n            if (scanf(\"%lld\", &val) == 1) sum += val;\n        }\n"
                "        printf(\"%lld\", sum);\n    }\n    return 0;\n}\n"
            ),
        },
        {
            "number": 10,
            "title": "Find Maximum Element in Array",
            "slug": "find-max-in-array",
            "difficulty": "Easy",
            "topics": ["Arrays"],
            "description": "Given an integer n followed by n integers, determine and print the maximum element in the array.",
            "input_format": "First line contains integer n. Second line contains n space-separated integers.",
            "output_format": "Print the maximum element in the array.",
            "constraints": ["1 <= n <= 1000", "-10^9 <= arr[i] <= 10^9"],
            "hints": ["Initialize max_val with the first element and update as you read remaining elements"],
            "time_limit": 2.0,
            "public_test_cases": [
                {"input": "5\n3 1 9 4 2\n", "expected_output": "9"},
                {"input": "3\n-10 -20 -5\n", "expected_output": "-5"},
            ],
            "hidden_test_cases": [
                {"input": "1\n42\n", "expected_output": "42"},
                {"input": "4\n7 7 7 7\n", "expected_output": "7"},
                {"input": "6\n100 200 500 50 10 300\n", "expected_output": "500"},
            ],
            "reference_solution_c": (
                "#include <stdio.h>\n\nint main() {\n    int n;\n"
                "    if (scanf(\"%d\", &n) == 1 && n > 0) {\n        long long max_val, val;\n"
                "        if (scanf(\"%lld\", &max_val) == 1) {\n            for (int i = 1; i < n; i++) {\n"
                "                if (scanf(\"%lld\", &val) == 1 && val > max_val) max_val = val;\n            }\n"
                "            printf(\"%lld\", max_val);\n        }\n    }\n    return 0;\n}\n"
            ),
        },
    ]
}


def seed_default_pack_for_week(week_id: str, week_number: int = 1) -> List[ProblemInPack]:
    """
    Populate a week with 10 standard, pre-verified LeetCode-style C problems (P1..P10).
    Verifies reference solutions against all test cases.
    """
    templates = SEED_PACKS_BY_WEEK.get(week_number, SEED_PACKS_BY_WEEK[1])
    problems: List[ProblemInPack] = []

    for item in templates:
        pub_cases = [TestCaseSchema(**tc) for tc in item["public_test_cases"]]
        hid_cases = [TestCaseSchema(**tc) for tc in item["hidden_test_cases"]]

        schema = GeneratedProblemSchema(
            title=item["title"],
            slug=item["slug"],
            difficulty=item["difficulty"],
            topics=item["topics"],
            description=item["description"],
            input_format=item["input_format"],
            output_format=item["output_format"],
            constraints=item["constraints"],
            hints=item["hints"],
            time_limit_seconds=item["time_limit"],
            public_test_cases=pub_cases,
            hidden_test_cases=hid_cases,
            reference_solution_c=item["reference_solution_c"],
        )

        verif = verify_reference_solution(schema)
        prob = ProblemInPack(
            id=f"{week_id}-p{item['number']}",
            week_id=week_id,
            number=item["number"],
            title=item["title"],
            slug=item["slug"],
            description=item["description"],
            difficulty=item["difficulty"],
            topics=item["topics"],
            constraints=item["constraints"],
            hints=item["hints"],
            time_limit=item["time_limit"],
            input_format=item["input_format"],
            output_format=item["output_format"],
            public_test_cases=pub_cases,
            hidden_test_cases=hid_cases,
            reference_solution_c=item["reference_solution_c"],
            is_verified=verif.all_matched,
            verification_report=verif,
        )
        save_problem(prob)
        problems.append(prob)

    return problems


async def generate_week_problem_pack(
    week_id: str,
    request: GeneratePackRequest,
) -> GeneratePackResponse:
    """
    Generate a complete problem pack for a week (P1..P10):
    1. Checks if week exists.
    2. Iteratively creates each problem:
       - If AI generation requested: queries LLM with topic context.
       - Validates JSON schema.
       - Compiles and runs reference solution against test cases.
       - If verification fails or LLM is offline, falls back to curriculum seed templates.
    3. Saves P1..P10 into the database linked to week_id.
    """
    week = get_week(week_id)
    if not week:
        return GeneratePackResponse(
            week_id=week_id,
            status="error",
            errors=[f"Week '{week_id}' was not found."],
        )

    target_count = max(1, min(request.number_of_problems, 10))
    problems: List[ProblemInPack] = []
    errors: List[str] = []

    # If LLM model is not explicitly provided or topics are standard, use curriculum seeding or LLM
    topic_list = request.topics or ["basics", "loops", "conditions", "arrays", "functions"]

    for num in range(1, target_count + 1):
        problem_saved = False
        topic = topic_list[(num - 1) % len(topic_list)]

        if request.model or request.provider == "gemini":
            # Attempt LLM generation
            prompt = f"Problem {num} of {target_count}: LeetCode-style C programming problem focusing on {topic}."
            gen_req = GenerateProblemRequest(
                prompt=prompt,
                difficulty=DifficultyEnum(request.difficulty) if request.difficulty in ["Easy", "Medium", "Hard"] else DifficultyEnum.EASY,
                topics=[topic],
                verify_with_reference=request.verify_with_reference,
                provider=request.provider or "gemini",
                model=request.model,
                api_key=request.api_key,
            )
            gen_resp = await generate_problem_from_llm(gen_req)
            if gen_resp.status == "success" and gen_resp.problem:
                p_schema = gen_resp.problem
                prob = ProblemInPack(
                    id=f"{week_id}-p{num}",
                    week_id=week_id,
                    number=num,
                    title=p_schema.title,
                    slug=p_schema.slug,
                    description=p_schema.description,
                    difficulty=p_schema.difficulty,
                    topics=p_schema.topics,
                    constraints=p_schema.constraints,
                    hints=p_schema.hints,
                    time_limit=p_schema.time_limit_seconds,
                    input_format=p_schema.input_format,
                    output_format=p_schema.output_format,
                    public_test_cases=p_schema.public_test_cases,
                    hidden_test_cases=p_schema.hidden_test_cases,
                    reference_solution_c=p_schema.reference_solution_c,
                    is_verified=gen_resp.verification_report.all_matched if gen_resp.verification_report else True,
                    verification_report=gen_resp.verification_report,
                )
                save_problem(prob)
                problems.append(prob)
                problem_saved = True

        if not problem_saved:
            # Fall back to curated template for this problem number
            curriculum = SEED_PACKS_BY_WEEK.get(week.week_number, SEED_PACKS_BY_WEEK[1])
            template_idx = (num - 1) % len(curriculum)
            template = curriculum[template_idx]

            pub_cases = [TestCaseSchema(**tc) for tc in template["public_test_cases"]]
            hid_cases = [TestCaseSchema(**tc) for tc in template["hidden_test_cases"]]

            schema = GeneratedProblemSchema(
                title=template["title"],
                slug=f"{template['slug']}-{num}",
                difficulty=template["difficulty"],
                topics=template["topics"],
                description=template["description"],
                input_format=template["input_format"],
                output_format=template["output_format"],
                constraints=template["constraints"],
                hints=template["hints"],
                time_limit_seconds=template["time_limit"],
                public_test_cases=pub_cases,
                hidden_test_cases=hid_cases,
                reference_solution_c=template["reference_solution_c"],
            )

            verif = verify_reference_solution(schema) if request.verify_with_reference else None
            prob = ProblemInPack(
                id=f"{week_id}-p{num}",
                week_id=week_id,
                number=num,
                title=template["title"],
                slug=f"{template['slug']}-{num}",
                description=template["description"],
                difficulty=template["difficulty"],
                topics=template["topics"],
                constraints=template["constraints"],
                hints=template["hints"],
                time_limit=template["time_limit"],
                input_format=template["input_format"],
                output_format=template["output_format"],
                public_test_cases=pub_cases,
                hidden_test_cases=hid_cases,
                reference_solution_c=template["reference_solution_c"],
                is_verified=verif.all_matched if verif else True,
                verification_report=verif,
            )
            save_problem(prob)
            problems.append(prob)

    verified_count = sum(1 for p in problems if p.is_verified)
    return GeneratePackResponse(
        week_id=week_id,
        status="success",
        total_generated=len(problems),
        total_verified=verified_count,
        problems=problems,
        errors=errors,
    )


def parse_questions_from_text(raw_text: str) -> List[str]:
    """Parse multiple questions from user pasted multiline text."""
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    if not lines:
        return []

    questions = []
    current_q = []
    # Match patterns like "1.", "1)", "1 -", "Q1:", "Problem 1:", "p1:"
    q_pattern = re.compile(r"^(?:(?:Q|p|problem)?\s*\d+[\.\)\:\-]|\[\d+\])\s*", re.IGNORECASE)

    for line in lines:
        if q_pattern.match(line):
            if current_q:
                questions.append(" ".join(current_q).strip())
                current_q = []
            cleaned_line = q_pattern.sub("", line).strip()
            current_q.append(cleaned_line or line)
        else:
            current_q.append(line)

    if current_q:
        questions.append(" ".join(current_q).strip())

    if not questions:
        questions = lines

    return [q for q in questions if q]


async def generate_problems_from_exact_questions(
    week_id: str,
    request: GenerateFromQuestionsRequest,
) -> GeneratePackResponse:
    """
    Take exact questions provided by the instructor and generate complete,
    LeetCode-style C programming problems with automated test cases and verified reference C code.
    """
    week = get_week(week_id)
    if not week:
        return GeneratePackResponse(
            week_id=week_id,
            status="error",
            errors=[f"Week '{week_id}' was not found."],
        )

    # 1. Collect all questions
    questions: List[str] = list(request.questions)
    if request.raw_text:
        parsed = parse_questions_from_text(request.raw_text)
        for p in parsed:
            if p not in questions:
                questions.append(p)

    if not questions:
        return GeneratePackResponse(
            week_id=week_id,
            status="error",
            errors=["No questions provided. Please enter at least one question."],
        )

    # Determine start problem number: append unless replace_all is explicitly True
    existing_problems = get_week_problems(week_id)
    if getattr(request, "replace_all", False):
        delete_week_problems(week_id)
        next_num = 1
    else:
        existing_numbers = {p.number for p in existing_problems}
        next_num = max(existing_numbers, default=0) + 1

    problems: List[ProblemInPack] = []
    errors: List[str] = []
    model_to_use = request.model or GEMINI_MODEL

    for idx, q_text in enumerate(questions, start=1):
        prob_num = next_num
        next_num += 1

        prompt = f"""EXACT QUESTION GIVEN BY INSTRUCTOR:
"{q_text}"

TASK:
Convert this exact question into a complete, standard LeetCode-style C programming problem.
- Problem title and description MUST directly solve this exact question.
- The solution MUST be written in C using standard input (scanf) and standard output (printf).
- Include precise input_format and output_format.
- Determine difficulty ("Easy", "Medium", or "Hard") based on the problem's conceptual and algorithmic complexity.
- Provide EXACTLY 5 diverse test cases in total:
  * Exactly 2 public_test_cases: standard/sample cases demonstrating typical valid inputs and expected formats.
  * Exactly 3 hidden_test_cases: edge cases, boundary limits (e.g. 0, negatives, min/max allowed values), and trap inputs where naive or normal student code fails (e.g. ties, off-by-one, empty/single element, integer overflow).
- Provide a complete, bug-free C reference solution (reference_solution_c) that passes all 5 test cases.
"""
        gen_req = GenerateProblemRequest(
            prompt=prompt,
            difficulty=DifficultyEnum(request.difficulty) if request.difficulty in ["Easy", "Medium", "Hard"] else None,
            topics=["Lab Exercise"],
            verify_with_reference=request.verify_with_reference,
            provider=request.provider or "gemini",
            model=model_to_use,
            api_key=request.api_key,
        )

        try:
            gen_resp = await generate_problem_from_llm(gen_req)
            if gen_resp.problem is not None:
                p_schema = gen_resp.problem
                is_verified = (
                    gen_resp.verification_report.all_matched
                    if gen_resp.verification_report
                    else (gen_resp.status == "success")
                )
                prob = ProblemInPack(
                    id=f"{week_id}-p{prob_num}",
                    week_id=week_id,
                    number=prob_num,
                    title=p_schema.title,
                    slug=f"{p_schema.slug}-{prob_num}",
                    description=p_schema.description,
                    difficulty=p_schema.difficulty or "Easy",
                    topics=p_schema.topics or ["Lab Exercise"],
                    constraints=p_schema.constraints,
                    hints=p_schema.hints,
                    time_limit=p_schema.time_limit_seconds,
                    input_format=p_schema.input_format,
                    output_format=p_schema.output_format,
                    public_test_cases=p_schema.public_test_cases,
                    hidden_test_cases=p_schema.hidden_test_cases,
                    reference_solution_c=p_schema.reference_solution_c,
                    is_verified=is_verified,
                    verification_report=gen_resp.verification_report,
                )
                save_problem(prob)
                problems.append(prob)

                # Brief rate-limit pause between sequential LLM calls
                if idx < len(questions):
                    await asyncio.sleep(1.0)
                continue
            else:
                errors.append(f"Q{prob_num} generation warning: {gen_resp.error}")
        except Exception as e:
            errors.append(f"Q{prob_num} LLM error: {str(e)}")

        # Fallback problem creation only if LLM completely failed to return any problem
        short_title = q_text.split("\n")[0][:45]
        prob = ProblemInPack(
            id=f"{week_id}-p{prob_num}",
            week_id=week_id,
            number=prob_num,
            title=short_title if len(short_title) > 3 else f"Problem {prob_num}",
            slug=f"problem-{prob_num}",
            description=q_text,
            difficulty="Easy",
            topics=["Lab Exercise"],
            constraints=["Standard constraints apply."],
            hints=["Implement according to problem specification."],
            time_limit=2.0,
            input_format="Standard input stream.",
            output_format="Standard output format.",
            public_test_cases=[
                TestCaseSchema(input="1\n", expected_output="1\n")
            ],
            hidden_test_cases=[
                TestCaseSchema(input="2\n", expected_output="2\n")
            ],
            reference_solution_c=(
                f"#include <stdio.h>\n\n/* Solution for: {q_text[:60]} */\nint main() {{\n    return 0;\n}}\n"
            ),
            is_verified=False,
            verification_report=None,
        )
        save_problem(prob)
        problems.append(prob)

    # Mark week as ready if problems exist
    if problems or existing_problems:
        update_week(week_id=week_id, status="ready")

    verified_count = sum(1 for p in problems if p.is_verified)
    return GeneratePackResponse(
        week_id=week_id,
        status="success" if problems else "error",
        total_generated=len(problems),
        total_verified=verified_count,
        problems=problems,
        errors=errors,
    )


async def generate_single_problem_from_exact_question(
    week_id: str,
    request: GenerateSingleQuestionRequest,
) -> GenerateSingleQuestionResponse:
    """
    Convert a single instructor question into a verified C problem with exactly 5 test cases
    (2 public, 3 hidden edge/trap cases) and save to SQLite.
    """
    week = get_week(week_id)
    if not week:
        return GenerateSingleQuestionResponse(
            status="error",
            error=f"Week '{week_id}' was not found.",
        )

    q_text = request.question_text.strip()
    if not q_text:
        return GenerateSingleQuestionResponse(
            status="error",
            error="Question text cannot be empty.",
        )

    existing_problems = get_week_problems(week_id)
    existing_by_num = {p.number: p for p in existing_problems}

    if request.problem_number is not None:
        prob_num = request.problem_number
        if prob_num in existing_by_num and request.replace_existing:
            delete_single_problem(week_id, prob_num)
    else:
        existing_numbers = set(existing_by_num.keys())
        prob_num = max(existing_numbers, default=0) + 1

    model_to_use = request.model or GEMINI_MODEL

    prompt = f"""EXACT QUESTION GIVEN BY INSTRUCTOR:
"{q_text}"

TASK:
Convert this exact question into a complete, standard LeetCode-style C programming problem.
- Problem title and description MUST directly solve this exact question.
- The solution MUST be written in C using standard input (scanf) and standard output (printf).
- Include precise input_format and output_format.
- Determine difficulty ("Easy", "Medium", or "Hard") based on algorithmic and conceptual complexity.
- Provide EXACTLY 5 diverse test cases in total:
  * Exactly 2 public_test_cases: standard/sample cases demonstrating typical valid inputs and expected formats.
  * Exactly 3 hidden_test_cases: edge cases, boundary limits (e.g. 0, negatives, min/max allowed values), and trap inputs where naive or normal student code fails (e.g. ties, off-by-one, empty/single element, integer overflow).
- Provide a complete, bug-free C reference solution (reference_solution_c) that handles all 5 test cases correctly.
"""

    gen_req = GenerateProblemRequest(
        prompt=prompt,
        difficulty=DifficultyEnum(request.difficulty) if request.difficulty in ["Easy", "Medium", "Hard"] else None,
        topics=["Lab Exercise"],
        verify_with_reference=request.verify_with_reference,
        provider=request.provider or "gemini",
        model=model_to_use,
        api_key=request.api_key,
    )

    try:
        gen_resp = await generate_problem_from_llm(gen_req)
        if gen_resp.problem is not None:
            p_schema = gen_resp.problem
            is_verified = (
                gen_resp.verification_report.all_matched
                if gen_resp.verification_report
                else (gen_resp.status == "success")
            )
            prob = ProblemInPack(
                id=f"{week_id}-p{prob_num}",
                week_id=week_id,
                number=prob_num,
                title=p_schema.title,
                slug=f"{p_schema.slug}-{prob_num}",
                description=p_schema.description,
                difficulty=p_schema.difficulty or "Easy",
                topics=p_schema.topics or ["Lab Exercise"],
                constraints=p_schema.constraints,
                hints=p_schema.hints,
                time_limit=p_schema.time_limit_seconds,
                input_format=p_schema.input_format,
                output_format=p_schema.output_format,
                public_test_cases=p_schema.public_test_cases,
                hidden_test_cases=p_schema.hidden_test_cases,
                reference_solution_c=p_schema.reference_solution_c,
                is_verified=is_verified,
                verification_report=gen_resp.verification_report,
            )
            save_problem(prob)
            update_week(week_id=week_id, status="ready")
            return GenerateSingleQuestionResponse(
                status="success",
                problem=prob,
                verification_report=gen_resp.verification_report,
            )
        else:
            return GenerateSingleQuestionResponse(
                status="error",
                error=gen_resp.error or "Failed to generate problem from question.",
            )
    except Exception as e:
        return GenerateSingleQuestionResponse(
            status="error",
            error=f"LLM generation failed: {str(e)}",
        )
