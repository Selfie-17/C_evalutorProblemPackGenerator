import os
import re
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from app.config import DATA_DIR
from app.models import (
    StudentProgramValidationItem,
    StudentValidationItem,
    ZipValidationReport,
)

STAGING_DIR: Path = DATA_DIR / "staging"
STAGING_DIR.mkdir(parents=True, exist_ok=True)

# Security Limits (Increased to 1 GB as requested)
MAX_ZIP_SIZE_BYTES: int = 1024 * 1024 * 1024          # 1 GB (1,073,741,824 bytes)
MAX_EXTRACT_SIZE_BYTES: int = 3 * 1024 * 1024 * 1024  # 3 GB
MAX_FILES_COUNT: int = 50000                        # 50,000 files

# Regexes for matching C program filenames:
# 1. Standard prefixes: p1.c, P1.C, prob1.c, problem1.c, program1.c, Program-1.c, PROGRAM1.c, Question1.c, q1.c, lab1.c, file1.c, files1.c, practise1.c, r1.c, ps1.c
PROGRAM_PREFIX_REGEX = re.compile(
    r"^(?:p|prob|problem|program|question|q|lab|file|files|practise|r|ps)[_-]?0*([1-9]\d?)\.c$",
    re.IGNORECASE,
)

# 2. Pure numbers: 1.c, 01.c, 13.c
PROGRAM_PLAIN_NUM_REGEX = re.compile(
    r"^0*([1-9]\d?)\.c$",
    re.IGNORECASE,
)

# 3. Numbers with suffix: 1qns.c, 10qns.c, etc.
PROGRAM_SUFFIX_REGEX = re.compile(
    r"^0*([1-9]\d?)[_-]?(?:qns|qn|ques|question)?\.c$",
    re.IGNORECASE,
)

# 4. Descriptive name ending in question number: leap_year4.c, memory_alloc5.c, switch6.c, Grade_10.c, etc.
PROGRAM_DESCRIPTIVE_NUM_REGEX = re.compile(
    r"^(?:.*?[_-]|.*?[a-zA-Z])0*([1-9]\d?)\.c$",
    re.IGNORECASE,
)

# Semantic keyword rules for when filenames do not contain numbers
SEMANTIC_RULES: List[Tuple[int, re.Pattern]] = [
    (1, re.compile(r"\b(?:even|odd|even_odd|even_or_odd|evenodd)\b", re.IGNORECASE)),
    (2, re.compile(r"\b(?:pos|neg|positive|negative|zerocheck|pos_neg)\b", re.IGNORECASE)),
    (3, re.compile(r"\b(?:char|ascii|upper|lower|character)\b", re.IGNORECASE)),
    (4, re.compile(r"\b(?:leap|leapyear|leap_year)\b", re.IGNORECASE)),
    (5, re.compile(r"\b(?:memory|sizeof|size|modifier|modifiers)\b", re.IGNORECASE)),
    (8, re.compile(r"\b(?:temp|3rd|with_var|swaping_with_variable|temporary)\b", re.IGNORECASE)),
    (7, re.compile(r"\b(?:without|swap_two|swap|swaping|swapping)\b", re.IGNORECASE)),
    (9, re.compile(r"\b(?:perfect|square|sqrt|perfect_square)\b", re.IGNORECASE)),
    (11, re.compile(r"\b(?:extend|invalid|menu_program_advanced|calculator_2|switch_err)\b", re.IGNORECASE)),
    (6, re.compile(r"\b(?:arithmetic|switch|menu|calc|calculator)\b", re.IGNORECASE)),
    (13, re.compile(r"\b(?:cgpa|letter_grade|numeric_grade|num_grade|converter13)\b", re.IGNORECASE)),
    (10, re.compile(r"\b(?:marks|finding_grade|grade|grading)\b", re.IGNORECASE)),
    (12, re.compile(r"\b(?:largest|greatest|great)\b", re.IGNORECASE)),
]

# Regex for matching 7-character Student IDs: starts with N/n followed by 6 digits (e.g. N180001, N240046)
STUDENT_ID_REGEX = re.compile(r"\b([Nn]\d{6})\b")
STUDENT_ID_RELAXED_REGEX = re.compile(r"([Nn]\d{6})")


def is_safe_zip_path(target_dir: Path, path: str) -> bool:
    """Ensure path doesn't escape the target directory (anti-Zip-Slip)."""
    resolved_target = target_dir.resolve()
    destination = (target_dir / path).resolve()
    return resolved_target in destination.parents or destination == resolved_target


def parse_problem_number(filename: str) -> Optional[int]:
    """
    Extract 1-based problem number from a C filename e.g.:
    - p1.c, P1.C, program02.c, Question13.c -> 1, 2, 13
    - 1.c, 10.c -> 1, 10
    - leap_year4.c, memory_alloc5.c -> 4, 5
    - even_odd.c, positive.c -> 1, 2 (via semantic keyword rules)
    """
    clean = filename.strip()
    if not clean.lower().endswith(".c"):
        return None

    for regex in (
        PROGRAM_PREFIX_REGEX,
        PROGRAM_PLAIN_NUM_REGEX,
        PROGRAM_SUFFIX_REGEX,
        PROGRAM_DESCRIPTIVE_NUM_REGEX,
    ):
        match = regex.match(clean)
        if match:
            try:
                num = int(match.group(1))
                if 1 <= num <= 50:
                    return num
            except ValueError:
                pass

    name_no_ext = clean[:-2]
    for prob_num, pattern in SEMANTIC_RULES:
        if pattern.search(name_no_ext):
            return prob_num

    return None


def extract_student_id_from_path(current_dir: Path, base_extract_path: Path) -> str:
    r"""
    Extract the canonical 7-character student ID (N + 6 digits, e.g. N180001, N240046) from folder hierarchy.
    Checks directory path components from outermost to innermost:
    1. Looks for any path component containing N\d{6} (case-insensitive).
    2. Normalizes to uppercase e.g. 'n180001' -> 'N180001'.
    3. Falls back to immediate directory name if no N-pattern is found.
    """
    try:
        rel_parts = current_dir.relative_to(base_extract_path).parts
    except ValueError:
        rel_parts = current_dir.parts

    # Search each directory level in path for N followed by 6 digits
    for part in rel_parts:
        match = STUDENT_ID_REGEX.search(part) or STUDENT_ID_RELAXED_REGEX.search(part)
        if match:
            return match.group(1).upper()

    return current_dir.name


def extract_and_validate_zip(
    zip_bytes: bytes,
    zip_filename: str = "submissions.zip",
    expected_problems_count: int = 10,
    section: str = "Section A",
) -> ZipValidationReport:
    """
    Safely extract student submissions ZIP and produce a detailed validation report:
    1. Enforces strict file size (up to 1 GB) & Zip Slip security limits.
    2. Handles nested student ZIP archives (e.g. bulk downloads containing N240050.zip).
    3. Only processes .c files, automatically ignoring .pdf and other document files.
    4. Discovers student directories and problem C source files (p1.c -> p13.c).
    5. Identifies missing files per student.
    6. Stores extracted files in a staging folder with unique staging token.
    """
    if len(zip_bytes) > MAX_ZIP_SIZE_BYTES:
        raise ValueError(
            f"ZIP file size ({len(zip_bytes)} bytes) exceeds maximum limit of 1 GB ({MAX_ZIP_SIZE_BYTES} bytes)."
        )

    staging_token = f"stage_{uuid.uuid4().hex[:12]}"
    extract_path = STAGING_DIR / staging_token
    extract_path.mkdir(parents=True, exist_ok=True)

    warnings: List[str] = []
    total_uncompressed_bytes = 0
    file_count = 0

    zip_file_path = extract_path / "original.zip"
    zip_file_path.write_bytes(zip_bytes)

    try:
        with zipfile.ZipFile(zip_file_path, "r") as zf:
            infolist = zf.infolist()
            if len(infolist) > MAX_FILES_COUNT:
                raise ValueError(f"ZIP contains {len(infolist)} files, exceeding limit of {MAX_FILES_COUNT}.")

            for member in infolist:
                # Security checks
                if ".." in member.filename or member.filename.startswith(("/", "\\")):
                    warnings.append(f"Skipped unsafe path: {member.filename}")
                    continue

                if not is_safe_zip_path(extract_path, member.filename):
                    warnings.append(f"Skipped unsafe resolved path: {member.filename}")
                    continue

                total_uncompressed_bytes += member.file_size
                if total_uncompressed_bytes > MAX_EXTRACT_SIZE_BYTES:
                    raise ValueError(f"Total uncompressed size exceeds limit of 3 GB ({MAX_EXTRACT_SIZE_BYTES} bytes).")

                # Ignore macOS and hidden directory metadata
                parts = Path(member.filename).parts
                if any(p.startswith(".") or p.startswith("__MACOSX") for p in parts):
                    continue

                zf.extract(member, extract_path)
                file_count += 1
    except zipfile.BadZipFile:
        shutil.rmtree(extract_path, ignore_errors=True)
        raise ValueError("Invalid or corrupted ZIP archive.")

    # Automatically unpack nested student zip archives (e.g. bulk downloads containing N240050.zip, N240046.zip)
    for _ in range(2):
        nested_zips = [
            Path(root) / f
            for root, dirs, files in os.walk(extract_path)
            for f in files
            if f.lower().endswith(".zip") and (Path(root) / f) != zip_file_path
        ]
        if not nested_zips:
            break

        for n_zip in nested_zips:
            target_subfolder = n_zip.parent / n_zip.stem.strip()
            target_subfolder.mkdir(parents=True, exist_ok=True)
            try:
                with zipfile.ZipFile(n_zip, "r") as inner_zf:
                    for inner_member in inner_zf.infolist():
                        if ".." in inner_member.filename or inner_member.filename.startswith(("/", "\\")):
                            continue
                        if not is_safe_zip_path(target_subfolder, inner_member.filename):
                            continue
                        # Ignore PDFs, docs, and non-essential assets inside nested archives
                        if inner_member.filename.lower().endswith((".pdf", ".odt", ".docx", ".doc")):
                            continue
                        total_uncompressed_bytes += inner_member.file_size
                        if total_uncompressed_bytes > MAX_EXTRACT_SIZE_BYTES:
                            raise ValueError(f"Total uncompressed size exceeds limit of 3 GB ({MAX_EXTRACT_SIZE_BYTES} bytes).")
                        inner_zf.extract(inner_member, target_subfolder)
                        file_count += 1
            except zipfile.BadZipFile:
                warnings.append(f"Skipped corrupted nested archive: {n_zip.name}")
            finally:
                try:
                    n_zip.unlink(missing_ok=True)
                except Exception:
                    pass

    # Locate student folders and their C program files
    # Only take .c files; .pdf files (reports) are explicitly ignored after extraction
    student_map: Dict[str, Dict[int, Path]] = {}

    for root, dirs, files in os.walk(extract_path):
        current_dir = Path(root)
        if current_dir == extract_path:
            continue

        # Filter strictly for .c files; ignore .pdf and other non-code files
        c_files = [f for f in files if f.lower().endswith(".c")]
        if not c_files:
            continue

        # Check if directory path contains a 7-digit student ID (e.g. N180001, N240046) or fallback to dir name
        student_id = extract_student_id_from_path(current_dir, extract_path)
        if student_id not in student_map:
            student_map[student_id] = {}

        for filename in c_files:
            prob_num = parse_problem_number(filename)
            if prob_num is not None:
                student_map[student_id][prob_num] = current_dir / filename

    # Build validation report
    student_items: List[StudentValidationItem] = []
    total_found_programs = 0

    sorted_students = sorted(student_map.keys())
    for sid in sorted_students:
        probs = student_map[sid]
        found_in_student = 0
        program_items: List[StudentProgramValidationItem] = []

        for pnum in range(1, expected_problems_count + 1):
            if pnum in probs:
                program_items.append(
                    StudentProgramValidationItem(
                        problem_number=pnum,
                        found=True,
                        filename=probs[pnum].name,
                    )
                )
                found_in_student += 1
                total_found_programs += 1
            else:
                program_items.append(
                    StudentProgramValidationItem(
                        problem_number=pnum,
                        found=False,
                        filename=None,
                    )
                )

        missing_in_student = expected_problems_count - found_in_student
        student_items.append(
            StudentValidationItem(
                student_id=sid,
                total_found=found_in_student,
                missing_count=missing_in_student,
                programs=program_items,
            )
        )

    total_students = len(student_items)
    total_expected = total_students * expected_problems_count
    total_missing = total_expected - total_found_programs

    return ZipValidationReport(
        staging_token=staging_token,
        zip_filename=zip_filename,
        section=section or "Section A",
        total_students=total_students,
        total_expected_programs=total_expected,
        total_found_programs=total_found_programs,
        total_missing_programs=total_missing,
        students=student_items,
        warnings=warnings,
    )


def get_staged_student_files(staging_token: str) -> Dict[str, Dict[int, Path]]:
    """
    Retrieve mapping of student_id -> {problem_number: Path_to_c_file} for a staged extraction.
    Ignores .pdf and non-code files, mapping only valid .c programs.
    """
    staged_path = STAGING_DIR / staging_token
    if not staged_path.is_dir():
        raise FileNotFoundError(f"Staged extraction '{staging_token}' not found.")

    student_map: Dict[str, Dict[int, Path]] = {}

    for root, dirs, files in os.walk(staged_path):
        current_dir = Path(root)
        if current_dir == staged_path:
            continue

        c_files = [f for f in files if f.lower().endswith(".c")]
        if not c_files:
            continue

        student_id = extract_student_id_from_path(current_dir, staged_path)
        if student_id not in student_map:
            student_map[student_id] = {}

        for filename in c_files:
            prob_num = parse_problem_number(filename)
            if prob_num is not None:
                student_map[student_id][prob_num] = current_dir / filename

    return student_map


def cleanup_staging(staging_token: str) -> None:
    """Clean up staging directory after evaluation is complete."""
    staged_path = STAGING_DIR / staging_token
    if staged_path.is_dir():
        shutil.rmtree(staged_path, ignore_errors=True)
