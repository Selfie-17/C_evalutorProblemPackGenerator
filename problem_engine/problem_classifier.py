"""
AI Problem Classifier using local Qwen 2.5 Coder 3B (with rule-based fallback).
Extracts problem categories, concepts, language constructs, constraints, and test strategies.
"""

import json
import logging
import re
from typing import Any, Dict, List
import httpx

from app.config import (
    DEFAULT_LLM_MODEL,
    GEMINI_API_KEY,
    LLM_TIMEOUT_SECONDS,
    OLLAMA_BASE_URL,
    OLLAMA_NUM_GPU,
    VIVA_GEMINI_MODEL,
)
from problem_engine.problem_schema import Classification, Problem, TestStrategy

logger = logging.getLogger(__name__)


def _classify_heuristic(statement: str, index: int) -> Dict[str, Any]:
    """
    Deterministic rule-based fallback classifier when Ollama / Qwen is unavailable.
    Accurately detects C curriculum patterns (even/odd, leap year, menu calculator, ternary, swap, etc.).
    """
    s_lower = statement.lower()

    category = "conditional"
    difficulty = "easy"
    required_constructs = []
    concepts = []
    constraints = []
    test_strategy = TestStrategy(base_cases=2, boundary_cases=2, edge_cases=2, failing_cases=0, special_cases=1)

    # 1. Even or odd
    if "even" in s_lower and "odd" in s_lower:
        category = "conditional"
        difficulty = "easy"
        required_constructs = ["if-else", "%"]
        concepts = ["integer input", "modulus operator", "conditional branching"]
        test_strategy = TestStrategy(base_cases=2, boundary_cases=1, edge_cases=2, special_cases=1)

    # 2. Positive / Negative / Zero
    elif "positive" in s_lower and "negative" in s_lower:
        category = "conditional"
        difficulty = "easy"
        required_constructs = ["if-else if-else"]
        concepts = ["integer comparison", "multiway branching"]
        test_strategy = TestStrategy(base_cases=2, boundary_cases=3, edge_cases=2, special_cases=1)

    # 3. Character classification
    elif "uppercase" in s_lower or "character" in s_lower and ("digit" in s_lower or "letter" in s_lower):
        category = "character-io"
        difficulty = "easy"
        required_constructs = ["if-else", "ASCII comparisons"]
        concepts = ["char data type", "ASCII codes", "compound conditions"]
        test_strategy = TestStrategy(base_cases=4, boundary_cases=2, edge_cases=2, special_cases=1)

    # 4. Leap Year
    elif "leap" in s_lower and "year" in s_lower:
        category = "conditional"
        difficulty = "medium"
        required_constructs = ["logical operators (&&, ||)"]
        concepts = ["century year logic", "Gregorian calendar rules", "divisibility"]
        test_strategy = TestStrategy(base_cases=2, boundary_cases=2, edge_cases=3, special_cases=2)

    # 5. sizeof memory
    elif "sizeof" in s_lower or "memory allocation" in s_lower:
        category = "data-types"
        difficulty = "easy"
        required_constructs = ["sizeof()"]
        concepts = ["data types", "memory storage", "primitive types"]
        test_strategy = TestStrategy(base_cases=4, boundary_cases=1, edge_cases=1, special_cases=0)

    # 6. Menu calculator
    elif "calculator" in s_lower or "menu" in s_lower:
        category = "menu-driven"
        difficulty = "medium"
        required_constructs = ["switch-case", "arithmetic operators"]
        concepts = ["menu loops", "operator selection", "arithmetic"]
        if "invalid" in s_lower or "zero" in s_lower:
            constraints.append("Handle division by zero and invalid menu choices")
            test_strategy = TestStrategy(base_cases=4, boundary_cases=2, edge_cases=2, failing_cases=2, special_cases=2)
        else:
            test_strategy = TestStrategy(base_cases=4, boundary_cases=2, edge_cases=1, special_cases=1)

    # 7. Swap without temp / with temp
    elif "swap" in s_lower:
        category = "arithmetic"
        difficulty = "easy" if "using" in s_lower or "temporary" in s_lower and "without" not in s_lower else "medium"
        if "without" in s_lower:
            constraints.append("Do not use a third or temporary variable")
            required_constructs = ["arithmetic (+, -) or XOR (^)"]
            concepts = ["in-place value exchange", "arithmetic cancellation"]
        else:
            required_constructs = ["temporary variable assignment"]
            concepts = ["variable assignment", "value holding"]
        test_strategy = TestStrategy(base_cases=2, boundary_cases=2, edge_cases=2, metamorphic_cases=1)

    # 8. Perfect square
    elif "perfect square" in s_lower or ("square" in s_lower and "sqrt" in s_lower):
        category = "number-property"
        difficulty = "medium"
        constraints.append("Do not use the sqrt() library function")
        required_constructs = ["while or for loop", "integer multiplication"]
        concepts = ["exhaustive search", "integer square", "loop termination"]
        test_strategy = TestStrategy(base_cases=3, boundary_cases=2, edge_cases=2, special_cases=2)

    # 9. Student grade
    elif "grade" in s_lower:
        category = "grade-conversion"
        difficulty = "easy"
        if "switch" in s_lower:
            required_constructs = ["switch-case"]
        else:
            required_constructs = ["nested if-else / if-else ladder"]
        concepts = ["interval mapping", "score boundaries", "conditional grading"]
        test_strategy = TestStrategy(base_cases=3, boundary_cases=4, edge_cases=2, special_cases=1)

    # 10. Largest of three
    elif "largest" in s_lower or "greatest" in s_lower or "maximum" in s_lower:
        category = "conditional"
        difficulty = "easy"
        if "ternary" in s_lower:
            required_constructs = ["ternary operator (? :)"]
            concepts = ["conditional expressions", "nested ternary"]
        else:
            required_constructs = ["nested if-else"]
            concepts = ["relational operators", "transitive comparison"]
        test_strategy = TestStrategy(base_cases=3, boundary_cases=3, edge_cases=2, special_cases=2)

    return {
        "category": category,
        "difficulty": difficulty,
        "required_constructs": required_constructs,
        "concepts": concepts,
        "constraints": constraints,
        "test_strategy": test_strategy,
    }


async def classify_problem_with_qwen(problem: Problem) -> Problem:
    """
    Classify problem using local Qwen 2.5 Coder 3B via Ollama.
    Falls back gracefully to deterministic heuristic classification if Ollama is unreachable.
    """
    prompt = f"""You are an expert Computer Science Professor and C Programming Curriculum Designer.
Analyze this C lab problem statement and return a strict JSON object:

PROBLEM STATEMENT:
\"\"\"{problem.statement}\"\"\"

Return ONLY valid JSON matching this schema:
{{
  "title": "Concise 2-5 word Title",
  "category": "conditional | loop | menu-driven | number-property | arithmetic | character-io | data-types | grade-conversion",
  "difficulty": "easy | medium | hard",
  "requirements": ["Requirement 1", "Requirement 2"],
  "concepts": ["Concept 1", "Concept 2"],
  "constraints": ["Constraint 1 if any"],
  "required_constructs": ["e.g. ternary operator, switch-case, if-else, sizeof, loop"],
  "test_strategy": {{
    "base_cases": 2,
    "boundary_cases": 2,
    "edge_cases": 2,
    "failing_cases": 0,
    "special_cases": 1
  }}
}}
"""

    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
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
                raw_response = data.get("response", "").strip()
                parsed = json.loads(raw_response)

                if "title" in parsed and parsed["title"]:
                    problem.title = parsed["title"].strip()
                if "requirements" in parsed and isinstance(parsed["requirements"], list):
                    problem.requirements = parsed["requirements"]
                if "concepts" in parsed and isinstance(parsed["concepts"], list):
                    problem.concepts = parsed["concepts"]
                if "constraints" in parsed and isinstance(parsed["constraints"], list):
                    problem.constraints = parsed["constraints"]

                strat = parsed.get("test_strategy", {})
                problem.test_strategy = TestStrategy(
                    base_cases=int(strat.get("base_cases", 2)),
                    boundary_cases=int(strat.get("boundary_cases", 2)),
                    edge_cases=int(strat.get("edge_cases", 2)),
                    failing_cases=int(strat.get("failing_cases", 0)),
                    special_cases=int(strat.get("special_cases", 1)),
                )

                problem.classification = Classification(
                    category=parsed.get("category", "conditional"),
                    difficulty=parsed.get("difficulty", "easy"),
                    required_constructs=parsed.get("required_constructs", []),
                )
                return problem
    except Exception as e:
        logger.warning(f"Ollama/Qwen classification failed ({e}). Falling back to heuristic classifier.")

    # Fallback to deterministic heuristic classifier
    fallback = _classify_heuristic(problem.statement, 1)
    problem.classification = Classification(
        category=fallback["category"],
        difficulty=fallback["difficulty"],
        required_constructs=fallback["required_constructs"],
    )
    if fallback["concepts"] and not problem.concepts:
        problem.concepts = fallback["concepts"]
    if fallback["constraints"] and not problem.constraints:
        problem.constraints = fallback["constraints"]
    problem.test_strategy = fallback["test_strategy"]

    return problem


async def classify_problem_pack(problems: List[Problem]) -> List[Problem]:
    """Classify all problems in a problem pack sequentially."""
    classified = []
    for p in problems:
        cp = await classify_problem_with_qwen(p)
        classified.append(cp)
    return classified


async def classify_problems_batch_all(
    problems: List[Problem],
    provider: str = "qwen",
    api_key: Optional[str] = None,
) -> List[Problem]:
    """
    Feed all problems simultaneously in a single batch prompt to Qwen (GPU) or Gemini API.
    Extracts structured classification, constructs, concepts, constraints, and test strategies
    for all problems in one shot.
    """
    if not problems:
        return []

    lines = []
    for idx, p in enumerate(problems, start=1):
        lines.append(f"{idx}. {p.statement}")
    all_problems_text = "\n\n".join(lines)

    prompt = f"""You are an expert Computer Science Professor and C Programming Curriculum Designer.
Analyze all of the following C lab problems simultaneously and return a JSON array containing the structured classification and test strategy for EACH problem:

PROBLEMS:
{all_problems_text}

Return ONLY a valid JSON array of objects strictly matching this schema:
[
  {{
    "problem_index": 1,
    "title": "Concise 2-5 word Title",
    "category": "conditional | loop | menu-driven | number-property | arithmetic | character-io | data-types | grade-conversion",
    "difficulty": "easy | medium | hard",
    "requirements": ["Requirement 1"],
    "concepts": ["Concept 1"],
    "constraints": ["Constraint 1"],
    "required_constructs": ["e.g. ternary operator, switch-case, if-else, sizeof"],
    "test_strategy": {{
      "base_cases": 2,
      "boundary_cases": 2,
      "edge_cases": 2,
      "failing_cases": 0,
      "special_cases": 1
    }}
  }}
]
"""

    parsed_list = []
    provider_clean = (provider or "qwen").lower()

    if provider_clean == "gemini":
        effective_key = api_key or GEMINI_API_KEY
        target_model = VIVA_GEMINI_MODEL or "gemini-3.8-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={effective_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    raw = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        parsed_list = parsed
                    elif isinstance(parsed, dict):
                        parsed_list = parsed.get("problems", parsed.get("items", []))
        except Exception as e:
            logger.warning(f"Batch Gemini classification failed ({e}): falling back")
    else:
        # Default Qwen 2.5 Coder via Ollama with 100% GPU
        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
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
                    if isinstance(parsed, list):
                        parsed_list = parsed
                    elif isinstance(parsed, dict):
                        parsed_list = parsed.get("problems", parsed.get("items", []))
        except Exception as e:
            logger.warning(f"Batch Qwen classification failed ({e}): falling back")

    # Map parsed results back to Problem objects
    parsed_by_idx = {}
    for item in parsed_list:
        if isinstance(item, dict):
            idx = item.get("problem_index")
            if idx is not None:
                parsed_by_idx[int(idx)] = item

    for idx, p in enumerate(problems, start=1):
        item = parsed_by_idx.get(idx) or (parsed_list[idx - 1] if idx - 1 < len(parsed_list) and isinstance(parsed_list[idx - 1], dict) else None)
        if item:
            if "title" in item and item["title"]:
                p.title = str(item["title"]).strip()
            if "requirements" in item and isinstance(item["requirements"], list):
                p.requirements = item["requirements"]
            if "concepts" in item and isinstance(item["concepts"], list):
                p.concepts = item["concepts"]
            if "constraints" in item and isinstance(item["constraints"], list):
                p.constraints = item["constraints"]

            strat = item.get("test_strategy", {})
            p.test_strategy = TestStrategy(
                base_cases=int(strat.get("base_cases", 2)),
                boundary_cases=int(strat.get("boundary_cases", 2)),
                edge_cases=int(strat.get("edge_cases", 2)),
                failing_cases=int(strat.get("failing_cases", 0)),
                special_cases=int(strat.get("special_cases", 1)),
            )

            p.classification = Classification(
                category=item.get("category", "conditional"),
                difficulty=item.get("difficulty", "easy"),
                required_constructs=item.get("required_constructs", []),
            )
        else:
            # Fallback heuristic for any missing problem in batch
            fallback = _classify_heuristic(p.statement, idx)
            p.classification = Classification(
                category=fallback["category"],
                difficulty=fallback["difficulty"],
                required_constructs=fallback["required_constructs"],
            )
            if fallback["concepts"] and not p.concepts:
                p.concepts = fallback["concepts"]
            if fallback["constraints"] and not p.constraints:
                p.constraints = fallback["constraints"]
            p.test_strategy = fallback["test_strategy"]

    return problems

