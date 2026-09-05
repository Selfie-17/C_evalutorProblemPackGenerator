"""
Gemini Reviewer Module.
Uses Google Gemini API to critically evaluate AI-generated test cases,
check boundary completeness, identify edge case oversights,
and propose high-value additional test cases.
"""

import json
import logging
from typing import Any, Dict, List, Optional
import httpx

from app.config import GEMINI_API_KEY, LLM_TIMEOUT_SECONDS, VIVA_GEMINI_MODEL
from problem_engine.problem_schema import Problem, TestCase

logger = logging.getLogger(__name__)

GEMINI_REVIEW_SYSTEM_PROMPT = """You are a Principal Software Quality Assurance Engineer and C Language Guru.
Your job is to critically review the test suite generated for a C laboratory problem.

EVALUATE:
1. Classification Accuracy: Does the problem category and difficulty match?
2. Boundary & Edge Coverage: Are edge conditions (zeros, negative values, maximum integer limits, empty inputs) thoroughly tested?
3. Output Correctness: Are the expected outputs mathematically and syntactically correct for C programs?
4. Missing Pitfalls: What common bugs might student C code contain that these tests would fail to catch?

OUTPUT FORMAT:
Return ONLY valid JSON conforming to this schema:
{
  "verdict": "approved | needs_attention | critical_issues_found",
  "coverage_score": 85,
  "summary": "Concise 1-2 sentence executive assessment",
  "strengths": ["List of good coverage points"],
  "concerns": ["List of identified gaps or edge case omissions"],
  "suggested_test_cases": [
    {
      "category": "boundary | edge | failing | special | stress | metamorphic",
      "input": "stdin with newline",
      "expected_output": "expected stdout with newline",
      "reason": "Why this specific test case should be added",
      "severity": "normal | critical | optional"
    }
  ]
}
"""


async def review_problem_with_gemini(
    problem: Problem,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Review a problem and its test cases using Google Gemini Flash API.
    Returns structured review results.
    """
    effective_key = api_key or GEMINI_API_KEY
    if not effective_key:
        return {
            "configured": False,
            "error": "Gemini API key is not configured. Provide an API key to enable Gemini reviews.",
            "verdict": "unreviewed",
            "coverage_score": 0,
            "summary": "Gemini review unavailable (missing API key).",
            "strengths": [],
            "concerns": [],
            "suggested_test_cases": [],
        }

    target_model = model_name or VIVA_GEMINI_MODEL or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={effective_key}"

    # Prepare existing test case representation
    test_cases_summary = [
        {
            "test_id": tc.test_id,
            "category": tc.category,
            "input": tc.input,
            "expected_output": tc.expected_output,
            "reason": tc.reason,
            "validation_status": tc.validation_status,
        }
        for tc in problem.test_cases
    ]

    prompt = f"""PROBLEM DETAILS:
Problem ID: {problem.problem_id}
Title: {problem.title}
Statement:
{problem.statement}

Category: {problem.classification.category} ({problem.classification.difficulty})
Requirements: {json.dumps(problem.requirements)}
Constraints: {json.dumps(problem.constraints)}

CURRENT TEST SUITE ({len(problem.test_cases)} test cases):
{json.dumps(test_cases_summary, indent=2)}

Please review this test suite thoroughly.
"""

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": f"{GEMINI_REVIEW_SYSTEM_PROMPT}\n\n---\n\n{prompt}"
                    }
                ],
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error(f"Gemini API returned status {resp.status_code}: {resp.text}")
                return {
                    "configured": True,
                    "error": f"Gemini API error ({resp.status_code}): {resp.text[:200]}",
                    "verdict": "error",
                    "coverage_score": 0,
                    "summary": "Failed to receive response from Gemini API.",
                    "strengths": [],
                    "concerns": [],
                    "suggested_test_cases": [],
                }

            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)
            parsed["configured"] = True
            return parsed

    except Exception as e:
        logger.error(f"Exception calling Gemini API for problem review: {e}")
        return {
            "configured": True,
            "error": str(e),
            "verdict": "error",
            "coverage_score": 0,
            "summary": f"Review failed: {str(e)}",
            "strengths": [],
            "concerns": [],
            "suggested_test_cases": [],
        }
