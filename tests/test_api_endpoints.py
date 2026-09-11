"""
End-to-End API Integration Tests for Problem Engine endpoints.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_gemini_status_endpoint():
    response = client.get("/api/problem-engine/gemini-status")
    assert response.status_code == 200
    data = response.json()
    assert "configured" in data
    assert "model" in data


def test_sample_json_endpoint():
    response = client.get("/api/problem-engine/sample-json")
    assert response.status_code == 200
    data = response.json()
    assert data["schema_version"] == "1.0"
    assert data["total_problems"] == 2
    assert len(data["problems"]) == 2


def test_parse_and_validate_flow():
    raw = """1. Write a C program to check whether a given number is even or odd.
2. Write a C program to find the largest of three numbers.
"""
    # 1. Parse
    parse_resp = client.post("/api/problem-engine/parse", json={"raw_text": raw})
    assert parse_resp.status_code == 200
    pack_data = parse_resp.json()["pack"]
    assert len(pack_data["problems"]) == 2
    assert pack_data["problems"][0]["problem_id"] == "P1"

    # 2. Validate JSON
    val_resp = client.post("/api/problem-engine/validate-json", json={"raw_content": pack_data})
    assert val_resp.status_code == 200
    assert val_resp.json()["valid"] is True


def test_generate_problem_endpoint():
    prob_data = {
        "problem_id": "P1",
        "title": "Check Even or Odd",
        "statement": "Write a C program to check whether a given number is even or odd.",
    }
    response = client.post(
        "/api/problem-engine/generate-problem",
        json={
            "problem": prob_data,
            "provider": "qwen",
            "target_count": 50,
        },
    )
    assert response.status_code == 200
    problem = response.json()["problem"]
    assert len(problem["test_cases"]) >= 50
    # Every test case is deterministically validated
    for tc in problem["test_cases"]:
        assert tc["validation_status"] in ["passed", "manual_review_required"]


def test_leetcode_runner_endpoint():
    c_code = """#include <stdio.h>
int main() {
    long long n;
    if (scanf("%lld", &n) == 1) {
        if (n % 2 == 0) printf("Even\\n");
        else printf("Odd\\n");
    }
    return 0;
}
"""
    # Test batch run against 3 test cases
    test_cases = [
        {"test_id": "T1", "input": "4\n", "expected_output": "Even\n"},
        {"test_id": "T2", "input": "7\n", "expected_output": "Odd\n"},
        {"test_id": "T3", "input": "0\n", "expected_output": "Even\n"},
    ]

    response = client.post(
        "/api/problem-engine/run-code",
        json={
            "code": c_code,
            "test_cases": test_cases,
        },
    )
    assert response.status_code == 200
    res = response.json()
    assert res["mode"] == "batch"
    assert res["verdict"] == "Accepted"
    assert res["total_test_cases"] == 3
    assert res["passed_test_cases"] == 3
    assert len(res["results"]) == 3
    assert res["results"][0]["passed"] is True


def test_health_endpoint_get_and_head():
    get_resp = client.get("/health")
    assert get_resp.status_code == 200
    assert "gcc_available" in get_resp.json()

    head_resp = client.head("/health")
    assert head_resp.status_code == 200

