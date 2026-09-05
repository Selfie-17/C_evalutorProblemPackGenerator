from app.services.judge import judge_solution, evaluate_c_submission
from app.problems import TestCase

# Test 1: Valid C solution
valid_code = """#include <stdio.h>
int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) {
        printf("%d", a + b);
    }
    return 0;
}
"""
ok_res = evaluate_c_submission(valid_code, [
    TestCase(input="2 3", expected_output="5"),
    TestCase(input="10 20", expected_output="30"),
])
print("TEST 1 - Valid code:", ok_res.verdict, f"Passed: {ok_res.test_cases.passed}/{ok_res.test_cases.total}")
assert ok_res.verdict == "ACCEPTED"
assert ok_res.test_cases.passed == 2
assert ok_res.compilation.success is True

# Test 2: Syntax Error C solution
bad_code = """#include <stdio.h>
int main() {
    int a
    return 0;
}
"""
err_res = evaluate_c_submission(bad_code, [TestCase(input="", expected_output="")])
print("TEST 2 - Syntax error:", err_res.verdict, f"Errors: {len(err_res.compilation.errors)}")
assert err_res.verdict == "COMPILATION_ERROR"
assert len(err_res.compilation.errors) > 0
first_err = err_res.compilation.errors[0]
print(f"  Line: {first_err.line}, Col: {first_err.column}, Msg: {first_err.message}")
print(f"  Context: {first_err.source_context}")
assert first_err.line == 4 or first_err.line == 3

# Test 3: Backward compatible judge_solution
submit_res = judge_solution("sum-two-numbers", valid_code)
print("TEST 3 - judge_solution:", submit_res.status, f"Passed: {submit_res.passed_test_cases}/{submit_res.total_test_cases}")
assert submit_res.status == "accepted"

print("\nALL PHASE 2 TESTS PASSED PERFECTLY!")
