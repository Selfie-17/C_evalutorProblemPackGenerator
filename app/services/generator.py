import json
import re
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

from app.config import (
    DEFAULT_LLM_MODEL,
    LLM_OPENAI_BASE_URL,
    LLM_TIMEOUT_SECONDS,
    OLLAMA_BASE_URL,
)
from app.models import (
    ExampleCase,
    GeneratedProblemSchema,
    GenerateProblemRequest,
    GenerateProblemResponse,
    LLMStatusResponse,
    TestCaseSchema,
    VerificationCaseResult,
    VerificationReport,
)
from app.problems import Problem, TestCase, get_problem, register_problem
from app.services.compiler import compile_source_file, execute_binary
from app.services.judge import normalize_output

SYSTEM_PROMPT = """You are an expert competitive programming problem setter.
Generate a complete, high-quality coding problem in strict JSON format.

RULES:
1. The problem MUST be solved in C using standard input (stdin) and standard output (stdout).
2. The user will write a standard C program (e.g. using scanf and printf). Do NOT use LeetCode class/function wrappers.
3. Schema & Key Naming Requirements:
   - title: string
   - slug: lowercase hyphenated unique identifier (e.g. "find-maximum-element")
   - difficulty: "Easy", "Medium", or "Hard"
   - topics: list of strings (e.g. ["Array", "Math"])
   - description: clear, unambiguous problem statement
   - input_format: precise explanation of stdin format (e.g. "First line contains integer N, followed by N space-separated integers")
   - output_format: precise explanation of stdout format
   - examples: list of {"input": "...", "output": "...", "explanation": "..."}. (Notice: use "output", NOT "expected_output" in examples).
   - constraints: list of strings (e.g. ["1 <= N <= 1000", "-10^6 <= A[i] <= 10^6"])
   - time_limit_seconds: float (default 2.0)
   - memory_limit_mb: integer (default 256)
   - public_test_cases: list of {"input": "...", "expected_output": "..."}. (Notice: use "expected_output" here).
   - hidden_test_cases: list of 3-5 {"input": "...", "expected_output": "..."} covering edge cases (zero, negative, bounds, single element).
   - reference_solution_c: MUST be a single string containing the complete C code (e.g. "#include <stdio.h>\\nint main() { ... }"). Do NOT wrap it inside an object/dict like {"code": "..."}.
   - hints: list of helpful strings
   - follow_up: optional string or null
4. Output MUST be ONLY valid JSON matching the exact schema without any markdown formatting, backticks, or extra commentary.
"""


def slugify(text: str) -> str:
    """Generate a clean URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


async def check_llm_status() -> LLMStatusResponse:
    """Check connectivity to Ollama / local LLM server and list installed models."""
    backend = "ollama"
    base_url = OLLAMA_BASE_URL

    if LLM_OPENAI_BASE_URL:
        backend = "openai-compatible"
        base_url = LLM_OPENAI_BASE_URL
        url = f"{base_url}/models"
    else:
        url = f"{base_url}/api/tags"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if backend == "ollama":
                    models = [m.get("name", "") for m in data.get("models", [])]
                else:
                    models = [m.get("id", "") for m in data.get("data", [])]

                return LLMStatusResponse(
                    status="online",
                    backend=backend,
                    base_url=base_url,
                    configured_model=DEFAULT_LLM_MODEL,
                    available_models=models,
                )
            else:
                return LLMStatusResponse(
                    status="offline",
                    backend=backend,
                    base_url=base_url,
                    configured_model=DEFAULT_LLM_MODEL,
                    error=f"HTTP {resp.status_code}: {resp.text}",
                )
    except Exception as e:
        return LLMStatusResponse(
            status="offline",
            backend=backend,
            base_url=base_url,
            configured_model=DEFAULT_LLM_MODEL,
            error=str(e),
        )


async def query_local_llm(
    prompt: str,
    model_name: str = DEFAULT_LLM_MODEL,
    system_prompt: str = SYSTEM_PROMPT,
) -> str:
    """Query Ollama or OpenAI-compatible local server for JSON output."""
    if LLM_OPENAI_BASE_URL:
        url = f"{LLM_OPENAI_BASE_URL}/chat/completions"
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            res_data = resp.json()
            return res_data["choices"][0]["message"]["content"]
    else:
        url = f"{OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": model_name,
            "system": system_prompt,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.3,
            },
        }
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            res_data = resp.json()
            return res_data.get("response", "")


def verify_reference_solution(
    problem_schema: GeneratedProblemSchema,
) -> VerificationReport:
    """
    Verifies that the reference C solution compiles and produces exact expected outputs
    for every public and hidden test case.
    """
    if not problem_schema.reference_solution_c:
        return VerificationReport(
            compiled_successfully=False,
            compilation_output="No reference C solution provided.",
            all_matched=False,
        )

    all_test_cases = [
        (tc, False) for tc in problem_schema.public_test_cases
    ] + [
        (tc, True) for tc in problem_schema.hidden_test_cases
    ]

    with tempfile.TemporaryDirectory(prefix="c_verify_ref_") as temp_dir:
        temp_path = Path(temp_dir)
        source_file = temp_path / "reference.c"
        executable_file = temp_path / "reference.exe"

        # Write C reference solution
        source_file.write_text(problem_schema.reference_solution_c, encoding="utf-8")

        # Compile
        is_compiled, compilation_output, _ = compile_source_file(
            source_file=source_file,
            executable_file=executable_file,
            temp_dir=temp_dir,
        )

        if not is_compiled:
            return VerificationReport(
                compiled_successfully=False,
                compilation_output=compilation_output,
                total_test_cases=len(all_test_cases),
                matched_test_cases=0,
                all_matched=False,
            )

        details: List[VerificationCaseResult] = []
        matched_count = 0

        for idx, (tc, is_hidden) in enumerate(all_test_cases, start=1):
            exit_code, stdout, stderr, elapsed_ms, is_timeout = execute_binary(
                executable_file=executable_file,
                temp_dir=temp_dir,
                stdin_data=tc.input,
                timeout=problem_schema.time_limit_seconds,
            )

            if is_timeout:
                details.append(
                    VerificationCaseResult(
                        test_case_number=idx,
                        is_hidden=is_hidden,
                        input=tc.input,
                        expected_output=tc.expected_output,
                        reference_output="",
                        matched=False,
                        status="time_limit_exceeded",
                        execution_time_ms=elapsed_ms,
                    )
                )
                continue

            if exit_code != 0:
                details.append(
                    VerificationCaseResult(
                        test_case_number=idx,
                        is_hidden=is_hidden,
                        input=tc.input,
                        expected_output=tc.expected_output,
                        reference_output=stdout,
                        matched=False,
                        status="runtime_error",
                        execution_time_ms=elapsed_ms,
                    )
                )
                continue

            ref_norm = normalize_output(stdout)
            exp_norm = normalize_output(tc.expected_output)
            is_match = (ref_norm == exp_norm)

            if is_match:
                matched_count += 1

            details.append(
                VerificationCaseResult(
                    test_case_number=idx,
                    is_hidden=is_hidden,
                    input=tc.input,
                    expected_output=tc.expected_output,
                    reference_output=stdout,
                    matched=is_match,
                    status="matched" if is_match else "output_mismatch",
                    execution_time_ms=elapsed_ms,
                )
            )

        all_matched = (matched_count == len(all_test_cases))

        return VerificationReport(
            compiled_successfully=True,
            compilation_output=compilation_output,
            total_test_cases=len(all_test_cases),
            matched_test_cases=matched_count,
            all_matched=all_matched,
            details=details,
        )


async def generate_problem_from_llm(
    request: GenerateProblemRequest,
) -> GenerateProblemResponse:
    """
    Full pipeline to generate, validate, verify, and register a LeetCode-style C problem.
    """
    model_to_use = request.model or DEFAULT_LLM_MODEL
    user_prompt = f"""Problem Idea / Description: {request.prompt}
Target Difficulty: {request.difficulty.value if request.difficulty else 'Easy'}
Target Topics: {', '.join(request.topics) if request.topics else 'General'}

Generate a complete competitive programming problem in C stdin/stdout style matching the JSON specification."""

    start_time = time.perf_counter()

    # 1. Query Local LLM
    try:
        raw_json_str = await query_local_llm(
            prompt=user_prompt,
            model_name=model_to_use,
        )
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return GenerateProblemResponse(
            status="llm_error",
            error=f"Local LLM query failed: {str(e)}. Make sure Ollama is running (`ollama serve`).",
            model_used=model_to_use,
            generation_time_ms=elapsed_ms,
        )

    # 2. Parse & Validate JSON
    try:
        # Strip potential markdown code fences if model enclosed JSON
        cleaned_json = raw_json_str.strip()
        if cleaned_json.startswith("```json"):
            cleaned_json = cleaned_json[7:]
        if cleaned_json.startswith("```"):
            cleaned_json = cleaned_json[3:]
        if cleaned_json.endswith("```"):
            cleaned_json = cleaned_json[:-3]
        cleaned_json = cleaned_json.strip()

        problem_data = json.loads(cleaned_json)
        problem_schema = GeneratedProblemSchema.model_validate(problem_data)
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return GenerateProblemResponse(
            status="validation_failed",
            error=f"JSON schema validation error: {str(e)}",
            model_used=model_to_use,
            generation_time_ms=elapsed_ms,
        )

    # Ensure unique slug
    base_slug = slugify(problem_schema.slug or problem_schema.title)
    final_slug = base_slug
    counter = 1
    while get_problem(final_slug) is not None:
        final_slug = f"{base_slug}-{counter}"
        counter += 1
    problem_schema.slug = final_slug

    # 3. Reference Solution Verification
    verification_report = None
    if request.verify_with_reference and problem_schema.reference_solution_c:
        verification_report = verify_reference_solution(problem_schema)
        if not verification_report.all_matched:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            mismatch_count = verification_report.total_test_cases - verification_report.matched_test_cases
            return GenerateProblemResponse(
                status="verification_failed",
                problem=problem_schema,
                verification_report=verification_report,
                error=f"Reference verification failed: {mismatch_count} of {verification_report.total_test_cases} test cases mismatched reference output.",
                model_used=model_to_use,
                generation_time_ms=elapsed_ms,
            )

    # 4. Register Problem in active store & persist
    sample_cases = [
        TestCase(input=tc.input, expected_output=tc.expected_output, is_hidden=False)
        for tc in problem_schema.public_test_cases
    ]
    hidden_cases = [
        TestCase(input=tc.input, expected_output=tc.expected_output, is_hidden=True)
        for tc in problem_schema.hidden_test_cases
    ]

    new_problem = Problem(
        id=problem_schema.slug,
        title=problem_schema.title,
        description=problem_schema.description,
        time_limit=problem_schema.time_limit_seconds,
        input_format=problem_schema.input_format,
        output_format=problem_schema.output_format,
        constraints=problem_schema.constraints,
        difficulty=problem_schema.difficulty,
        topics=problem_schema.topics,
        hints=problem_schema.hints,
        sample_cases=sample_cases,
        hidden_cases=hidden_cases,
    )

    register_problem(new_problem, persist=True)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return GenerateProblemResponse(
        status="success",
        problem=problem_schema,
        registered_problem_id=new_problem.id,
        verification_report=verification_report,
        model_used=model_to_use,
        generation_time_ms=elapsed_ms,
    )
