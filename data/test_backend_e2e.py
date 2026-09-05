import io
import json
import time
import zipfile
from app.database.db import (
    create_week,
    delete_week,
    get_evaluation_job,
    get_student_submission,
    get_week,
    get_week_problems,
    list_weeks,
)
from app.services.analytics import compute_week_analytics
from app.services.evaluation import start_evaluation_job
from app.services.export import (
    generate_consolidated_week_json,
    generate_problem_pack_zip,
    generate_student_export_dict,
    generate_week_results_zip,
)
from app.services.pack_generator import seed_default_pack_for_week
from app.services.zip_processor import extract_and_validate_zip

print("=== STARTING COMPLETE BACKEND INTEGRATION TEST ===")

# Clean up existing test week if any
delete_week("week-01")

# 1. Create Week
week = create_week(week_number=1, title="Introduction to C", description="Basics of variables, loops, arrays")
print(f"Step 1: Created week '{week.id}' - {week.title}")
assert week.id == "week-01"

# 2. Seed Problem Pack P1..P10
problems = seed_default_pack_for_week(week.id, 1)
print(f"Step 2: Seeded {len(problems)} problems. Verified count: {sum(1 for p in problems if p.is_verified)}")
assert len(problems) == 10
assert all(p.is_verified for p in problems)

# 3. Create Student Submissions ZIP
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as z:
    # Student 22001: Perfect solutions for P1..P10 (using reference solutions)
    for p in problems:
        z.writestr(f"22001/p{p.number}.c", p.reference_solution_c)

    # Student 22002:
    # P1: Syntax error
    z.writestr("22002/p1.c", "#include <stdio.h>\nint main() {\n    int a, b\n    return 0;\n}")
    # P2: Wrong logic (always prints WRONG)
    z.writestr("22002/p2.c", '#include <stdio.h>\nint main() {\n    printf("WRONG\\n");\n    return 0;\n}')
    # P3..P10 are missing for 22002!

    # Student 22003:
    # P1: Correct
    z.writestr("22003/p1.c", problems[0].reference_solution_c)
    # P2..P10 are missing!

zip_bytes = buf.getvalue()
print("Step 3: Created in-memory test ZIP with 3 students.")

# 4. Extract and Validate ZIP
report = extract_and_validate_zip(zip_bytes, "week_01_submissions.zip", 10)
print(f"Step 4: Validation report -> Students detected: {report.total_students}, Found programs: {report.total_found_programs}, Missing: {report.total_missing_programs}")
assert report.total_students == 3
assert report.total_found_programs == 10 + 2 + 1  # 13 programs found
assert report.total_missing_programs == 17        # 30 - 13 = 17 missing

# 5. Start Batch Evaluation
job_id = start_evaluation_job(week.id, report.staging_token, continue_on_error=True)
print(f"Step 5: Started evaluation job '{job_id}'. Waiting for processing...")

# Poll until complete
max_wait = 40
start_t = time.time()
while time.time() - start_t < max_wait:
    job = get_evaluation_job(job_id)
    if job and job["status"] in ("completed", "failed"):
        break
    time.sleep(0.5)

print(f"Job Status: {job['status']}, Processed: {job['processed_submissions']}/{job['total_submissions']}")
assert job["status"] == "completed"
assert job["processed_submissions"] == 30

# 6. Verify Individual Submissions
# 22001 P1 should be ACCEPTED
sub_22001_p1 = get_student_submission(week.id, "22001", 1)
print(f"Student 22001 P1 Verdict: {sub_22001_p1.verdict} (Passed: {sub_22001_p1.passed_test_cases}/{sub_22001_p1.total_test_cases})")
assert sub_22001_p1.verdict == "ACCEPTED"

# 22002 P1 should be COMPILATION_ERROR with structured error
sub_22002_p1 = get_student_submission(week.id, "22002", 1)
print(f"Student 22002 P1 Verdict: {sub_22002_p1.verdict} (Errors: {len(sub_22002_p1.compilation.errors)})")
assert sub_22002_p1.verdict == "COMPILATION_ERROR"
assert len(sub_22002_p1.compilation.errors) > 0
print(f"  Diagnostics: Line {sub_22002_p1.compilation.errors[0].line}, Msg: {sub_22002_p1.compilation.errors[0].message}")
assert sub_22002_p1.compilation.errors[0].line in (3, 4)

# 22002 P2 should be WRONG_ANSWER
sub_22002_p2 = get_student_submission(week.id, "22002", 2)
print(f"Student 22002 P2 Verdict: {sub_22002_p2.verdict} (Passed: {sub_22002_p2.passed_test_cases}/{sub_22002_p2.total_test_cases})")
assert sub_22002_p2.verdict == "WRONG_ANSWER"

# 22002 P3 should be NOT_SUBMITTED
sub_22002_p3 = get_student_submission(week.id, "22002", 3)
print(f"Student 22002 P3 Verdict: {sub_22002_p3.verdict}")
assert sub_22002_p3.verdict == "NOT_SUBMITTED"

# 7. Verify Analytics
analytics = compute_week_analytics(week.id)
print(f"Step 7: Analytics -> Acceptance Rate: {analytics.overall_acceptance_rate}%, Accepted: {analytics.verdicts.accepted}, CE: {analytics.verdicts.compilation_error}, WA: {analytics.verdicts.wrong_answer}, Not Submitted: {analytics.verdicts.not_submitted}")
assert analytics.verdicts.accepted == 11  # 10 from 22001 + 1 from 22003
assert analytics.verdicts.compilation_error == 1
assert analytics.verdicts.wrong_answer == 1
assert analytics.verdicts.not_submitted == 17
assert "22001" in analytics.top_students
assert "22002" in analytics.struggling_students

# 8. Verify Exports
stu_export = generate_student_export_dict(week.id, "22001")
assert stu_export["student_id"] == "22001"
assert stu_export["summary"]["accepted"] == 10
print(f"Step 8a: Single Student Export JSON OK (Score: {stu_export['summary']['score_percentage']}%)")

week_json = generate_consolidated_week_json(week.id)
assert len(week_json) > 500
print("Step 8b: Consolidated Week JSON OK")

week_zip = generate_week_results_zip(week.id)
assert len(week_zip) > 1000
print(f"Step 8c: Week Results ZIP OK ({len(week_zip)} bytes)")

pack_zip = generate_problem_pack_zip(week.id)
assert len(pack_zip) > 1000
print(f"Step 8d: Problem Pack ZIP OK ({len(pack_zip)} bytes)")

print("\n=== ALL BACKEND PHASES 1-8 VERIFIED WITH 100% SUCCESS ===")
