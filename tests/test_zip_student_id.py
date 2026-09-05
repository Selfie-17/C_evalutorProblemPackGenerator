"""
Unit tests for Student ID (N + 6 digits, e.g. N180001) extraction in zip processor.
"""

import io
import zipfile
from pathlib import Path

from app.services.zip_processor import (
    extract_and_validate_zip,
    extract_student_id_from_path,
    parse_problem_number,
)


def test_parse_problem_number_extended():
    assert parse_problem_number("p1.c") == 1
    assert parse_problem_number("P01.c") == 1
    assert parse_problem_number("p10.c") == 10
    assert parse_problem_number("p13.c") == 13
    assert parse_problem_number("problem5.c") == 5
    assert parse_problem_number("prob_12.c") == 12
    assert parse_problem_number("notes.txt") is None


def test_extract_student_id_from_path():
    base = Path("/tmp/staging")

    # Direct N + 6 digits
    p1 = Path("/tmp/staging/N180001")
    assert extract_student_id_from_path(p1, base) == "N180001"

    # Lowercase n + 6 digits normalized to uppercase
    p2 = Path("/tmp/staging/n210543")
    assert extract_student_id_from_path(p2, base) == "N210543"

    # Nested inside a batch/section folder
    p3 = Path("/tmp/staging/Batch_A/N190045/assignment")
    assert extract_student_id_from_path(p3, base) == "N190045"

    # Suffix or extra name in folder
    p4 = Path("/tmp/staging/N200123_RaviKumar")
    assert extract_student_id_from_path(p4, base) == "N200123"

    # Non-N fallback to folder name
    p5 = Path("/tmp/staging/23001")
    assert extract_student_id_from_path(p5, base) == "23001"


def test_extract_and_validate_zip_with_n_ids():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        # Student 1: N180001 with 3 problems
        zf.writestr("LabBatch/N180001/p1.c", '#include <stdio.h>\nint main(){return 0;}')
        zf.writestr("LabBatch/N180001/p2.c", '#include <stdio.h>\nint main(){return 0;}')
        zf.writestr("LabBatch/N180001/p3.c", '#include <stdio.h>\nint main(){return 0;}')

        # Student 2: N180002 with 2 problems
        zf.writestr("LabBatch/n180002/p1.c", '#include <stdio.h>\nint main(){return 0;}')
        zf.writestr("LabBatch/n180002/p2.c", '#include <stdio.h>\nint main(){return 0;}')

    buf.seek(0)
    report = extract_and_validate_zip(
        zip_bytes=buf.getvalue(),
        zip_filename="test_batch.zip",
        expected_problems_count=3,
        section="Section A",
    )

    assert report.total_students == 2
    student_ids = [s.student_id for s in report.students]
    assert "N180001" in student_ids
    assert "N180002" in student_ids

    # Check N180001 has all 3 programs
    s1 = next(s for s in report.students if s.student_id == "N180001")
    assert s1.total_found == 3
    assert s1.missing_count == 0

    # Check N180002 has 2 programs and 1 missing (p3)
    s2 = next(s for s in report.students if s.student_id == "N180002")
    assert s2.total_found == 2
    assert s2.missing_count == 1
