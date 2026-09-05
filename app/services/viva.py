import json
import time
from typing import Any, Dict, List, Optional

import httpx

from app.config import (
    GEMINI_API_KEY,
    LLM_TIMEOUT_SECONDS,
    OLLAMA_BASE_URL,
    OLLAMA_NUM_GPU,
    VIVA_GEMINI_MODEL,
    VIVA_LLM_PROVIDER,
    VIVA_OLLAMA_MODEL,
)
from app.models import (
    GenerateVivaRequest,
    GenerateVivaResponse,
    VivaQuestion,
)
from app.problems import get_problem

VIVA_SYSTEM_PROMPT = """You are an expert technical interviewer and computer science professor conducting a personalized oral exam (viva voce) for a student's C programming submission.

Your goal is to test the student's true understanding of THEIR OWN CODE rather than asking generic C trivia.

ANALYSIS GUIDELINES:
1. Examine the problem requirements and the student's exact submitted C code.
2. Inspect the student's specific implementation decisions:
   - Variable declarations and initial values (e.g. why initialized to 0?)
   - Loop bounds and indexing (e.g. why i < N instead of i <= N?)
   - Conditional statements and operators (e.g. why modulo % 2 == 0?)
   - I/O handling (scanf format specifiers, & addresses, return values)
   - Edge cases (negative values, 0, array boundaries, overflow)
   - Algorithmic time and space complexity ($O(N)$, $O(1)$, etc.)
3. If the judge verdict is 'wrong_answer', 'time_limit_exceeded', or 'runtime_error', generate targeted debugging questions about the potential cause of failure.
4. If the judge verdict is 'accepted', ask about complexity, optimization, edge cases, and code modifications.

QUESTION TYPES TO INCLUDE:
- 'mcq': 4 clear options, 'correct_answer' (0-indexed integer 0..3), 'explanation', and 'related_code'.
- 'descriptive': 'Why' and conceptual reasoning questions with 'expected_answer' and 'related_code'.
- 'tricky': Edge case behavior (negative numbers, zero, large values) with 'expected_answer'.
- 'code_modification': 'What if we changed line X to Y?' or 'How would you adapt the code to...' with 'expected_answer'.
- 'debugging': Questions examining potential bugs, off-by-one errors, or complexity bottlenecks.

OUTPUT FORMAT:
Output ONLY valid JSON matching this structure:
{
  "code_summary": "Brief 1-2 sentence summary of student approach",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "difficulty": "easy",
      "category": "code_specific",
      "question": "Why is 'count' initialized to 0?",
      "options": [
        "To prevent garbage values and start counting from zero",
        "It is required by C syntax",
        "To allocate memory for the variable",
        "To make count a constant"
      ],
      "correct_answer": 0,
      "explanation": "Uninitialized local variables in C contain indeterminate garbage values.",
      "related_code": "int count = 0;"
    },
    {
      "id": 2,
      "type": "descriptive",
      "difficulty": "medium",
      "category": "why",
      "question": "Why was the condition 'num % 2 == 0' used?",
      "expected_answer": "The modulo operator computes the remainder of division by 2. Even integers leave a remainder of 0.",
      "explanation": "Modulo 2 tests parity.",
      "related_code": "if (num % 2 == 0)"
    }
  ]
}
"""


async def query_ollama_viva(prompt: str, model_name: str) -> str:
    """Query local Ollama for structured Viva JSON output."""
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": model_name,
        "system": VIVA_SYSTEM_PROMPT,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "num_gpu": OLLAMA_NUM_GPU,
        },
    }

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")


async def query_gemini_viva(prompt: str, model_name: str, api_key: str) -> str:
    """Query Google Gemini API for structured Viva JSON output."""
    if not api_key:
        raise ValueError(
            "Gemini API key is not configured. Please set GEMINI_API_KEY in .env or provide it in the request."
        )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": f"{VIVA_SYSTEM_PROMPT}\n\n---\n\n{prompt}"
                    }
                ],
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.3,
        },
    }

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini API error (HTTP {resp.status_code}): {resp.text}")
        data = resp.json()

        try:
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return raw_text
        except (KeyError, IndexError) as e:
            raise RuntimeError(f"Unexpected response structure from Gemini API: {data}") from e


def parse_and_validate_viva_json(raw_json_str: str) -> Tuple[Optional[str], List[VivaQuestion]]:
    """Parse, clean, and validate Viva JSON from LLM into VivaQuestion models."""
    cleaned = raw_json_str.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    parsed = json.loads(cleaned)

    # Handle either { "questions": [...] } or direct list [...]
    if isinstance(parsed, dict):
        code_summary = parsed.get("code_summary")
        questions_raw = parsed.get("questions") or []
    elif isinstance(parsed, list):
        code_summary = None
        questions_raw = parsed
    else:
        raise ValueError("Root JSON must be an object with a 'questions' array or a list of questions.")

    validated_questions: List[VivaQuestion] = []
    for idx, item in enumerate(questions_raw, start=1):
        if not isinstance(item, dict):
            continue
        if "id" not in item:
            item["id"] = idx
        q_model = VivaQuestion.model_validate(item)
        validated_questions.append(q_model)

    return code_summary, validated_questions


async def generate_viva_questions(
    request: GenerateVivaRequest,
) -> GenerateVivaResponse:
    """
    Generate personalized viva/interview questions for submitted C code:
    1. Resolve problem metadata if problem_id was provided.
    2. Determine LLM provider (Ollama or Gemini).
    3. Query LLM with rich code and verdict context.
    4. Validate and repair structured Viva questions.
    """
    start_time = time.perf_counter()

    # 1. Resolve Problem Context
    title = request.problem_title or "C Programming Task"
    description = request.problem_description or ""

    if request.problem_id:
        p = get_problem(request.problem_id)
        if p:
            title = p.title
            description = f"{p.description}\nConstraints: {', '.join(p.constraints)}"

    # 2. Determine Provider & Model
    selected_provider = (request.provider or VIVA_LLM_PROVIDER).lower()
    if selected_provider == "gemini":
        model_name = request.model or VIVA_GEMINI_MODEL
    else:
        selected_provider = "ollama"
        model_name = request.model or VIVA_OLLAMA_MODEL

    # 3. Construct Prompt
    verdict_info = "Not specified"
    if request.judge_result:
        verdict_info = json.dumps(request.judge_result, indent=2)

    prompt = f"""PROBLEM CONTEXT:
Title: {title}
Description: {description}

STUDENT SUBMITTED C CODE:
```c
{request.submitted_code}
```

JUDGE EXECUTION VERDICT:
{verdict_info}

TASK:
Analyze the student's implementation decisions and generate exactly {request.number_of_questions} personalized viva questions tailored to this specific code and verdict.
Ensure diverse question types: include MCQs with 4 options, descriptive 'Why' questions, tricky edge-case questions, and debugging/code-modification scenarios with exact 'related_code' snippets from the student's code.

Return ONLY valid JSON matching the specified schema."""

    # 4. Dispatch to Provider
    try:
        if selected_provider == "gemini":
            raw_response = await query_gemini_viva(
                prompt=prompt,
                model_name=model_name,
                api_key=GEMINI_API_KEY,
            )
        else:
            raw_response = await query_ollama_viva(
                prompt=prompt,
                model_name=model_name,
            )
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return GenerateVivaResponse(
            status="llm_error",
            provider_used=selected_provider,
            model_used=model_name,
            total_questions=0,
            generation_time_ms=elapsed_ms,
            error=f"Viva generation failed ({selected_provider}): {str(e)}",
        )

    # 5. Parse & Validate JSON
    try:
        code_summary, questions = parse_and_validate_viva_json(raw_response)
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return GenerateVivaResponse(
            status="validation_failed",
            provider_used=selected_provider,
            model_used=model_name,
            total_questions=0,
            generation_time_ms=elapsed_ms,
            error=f"JSON validation failed: {str(e)}. Raw model output: {raw_response[:300]}...",
        )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return GenerateVivaResponse(
        status="success",
        provider_used=selected_provider,
        model_used=model_name,
        total_questions=len(questions),
        questions=questions,
        code_summary=code_summary,
        generation_time_ms=elapsed_ms,
    )
