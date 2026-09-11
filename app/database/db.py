import json
import logging
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Union

from app.config import DATA_DIR, DATABASE_URL
from app.models import (
    CompilationDiagnostic,
    CompilationResult,
    JudgeVerdict,
    ProblemInPack,
    StudentSubmissionDetail,
    StudentSummaryItem,
    TestCaseExecutionDetail,
    TestCaseSchema,
    VerificationReport,
    WeekResponse,
)

logger = logging.getLogger(__name__)

DB_PATH: Path = DATA_DIR / "c_eval.db"

# Determine backend engine: PostgreSQL (Aiven/cloud) or SQLite (local development)
_is_postgres: bool = False
_pg_engine = None

if DATABASE_URL:
    url_lower = DATABASE_URL.lower()
    if url_lower.startswith("postgres://") or url_lower.startswith("postgresql://"):
        _is_postgres = True
        normalized_url = DATABASE_URL
        if normalized_url.startswith("postgres://"):
            normalized_url = "postgresql://" + normalized_url[len("postgres://"):]

        try:
            from sqlalchemy import create_engine

            _pg_engine = create_engine(
                normalized_url,
                pool_pre_ping=True,
                pool_recycle=300,
                pool_size=10,
                max_overflow=20,
            )
            logger.info("Configured PostgreSQL database backend with connection pooling.")
        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL engine with URL: {e}. Falling back to SQLite.")
            _is_postgres = False
            _pg_engine = None


def is_postgres_backend() -> bool:
    """Return True if connected to a remote PostgreSQL database."""
    return _is_postgres and (_pg_engine is not None)


class PgRow(dict):
    """Dictionary subclass providing dict-like access for PostgreSQL query rows."""

    def __getitem__(self, key: str) -> Any:
        return super().get(key)


class PgCursorWrapper:
    """Wraps PostgreSQL cursor to return PgRow objects with dictionary access."""

    def __init__(self, cursor: Any):
        self._cursor = cursor
        self.rowcount = cursor.rowcount

    def fetchone(self) -> Optional[PgRow]:
        row = self._cursor.fetchone()
        if row is None:
            return None
        if isinstance(row, dict):
            return PgRow(row)
        return PgRow(dict(row))

    def fetchall(self) -> List[PgRow]:
        rows = self._cursor.fetchall()
        if not rows:
            return []
        return [PgRow(r if isinstance(r, dict) else dict(r)) for r in rows]


class PgConnectionWrapper:
    """Adapts PostgreSQL raw connection to match sqlite3.Connection transactional interface."""

    def __init__(self, raw_conn: Any):
        self._conn = raw_conn

    def execute(self, sql: str, params: Optional[Union[tuple, list]] = None) -> PgCursorWrapper:
        translated_sql = re.sub(r"\?", "%s", sql)
        try:
            from psycopg.rows import dict_row

            cursor = self._conn.cursor(row_factory=dict_row)
        except Exception:
            try:
                import psycopg2.extras

                cursor = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            except Exception:
                cursor = self._conn.cursor()

        if params is not None:
            cursor.execute(translated_sql, tuple(params))
        else:
            cursor.execute(translated_sql)
        return PgCursorWrapper(cursor)

    def executescript(self, script: str) -> None:
        cursor = self._conn.cursor()
        cursor.execute(script)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def get_iso_now() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_db_connection() -> Generator[Any, None, None]:
    """
    Provide transactional scope:
    - On SQLite (local): connects to c_eval.db with WAL mode and foreign keys enabled.
    - On PostgreSQL (Aiven production): borrows connection from connection pool.
    """
    if not is_postgres_backend():
        conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        raw_conn = _pg_engine.raw_connection()
        wrapper = PgConnectionWrapper(raw_conn)
        try:
            yield wrapper
            wrapper.commit()
        except Exception:
            wrapper.rollback()
            raise
        finally:
            wrapper.close()


def init_db() -> None:
    """Initialize the database schema (compatible with both SQLite and PostgreSQL)."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with get_db_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS weeks (
            id TEXT PRIMARY KEY,
            week_number INTEGER NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS problems (
            id TEXT PRIMARY KEY,
            week_id TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
            number INTEGER NOT NULL,
            title TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT NOT NULL,
            input_format TEXT DEFAULT '',
            output_format TEXT DEFAULT '',
            constraints_json TEXT DEFAULT '[]',
            difficulty TEXT DEFAULT 'Easy',
            topics_json TEXT DEFAULT '[]',
            hints_json TEXT DEFAULT '[]',
            time_limit REAL DEFAULT 2.0,
            public_test_cases_json TEXT DEFAULT '[]',
            hidden_test_cases_json TEXT DEFAULT '[]',
            reference_solution_c TEXT DEFAULT '',
            is_verified INTEGER DEFAULT 0,
            verification_report_json TEXT DEFAULT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(week_id, number)
        );

        CREATE TABLE IF NOT EXISTS students (
            id TEXT NOT NULL,
            week_id TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
            name TEXT DEFAULT '',
            section TEXT DEFAULT 'Section A',
            created_at TEXT NOT NULL,
            PRIMARY KEY (week_id, id)
        );

        CREATE TABLE IF NOT EXISTS evaluation_jobs (
            id TEXT PRIMARY KEY,
            week_id TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
            section TEXT DEFAULT 'Section A',
            status TEXT DEFAULT 'queued',
            total_students INTEGER DEFAULT 0,
            processed_students INTEGER DEFAULT 0,
            total_submissions INTEGER DEFAULT 0,
            processed_submissions INTEGER DEFAULT 0,
            current_student TEXT DEFAULT '',
            continue_on_error INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            started_at TEXT DEFAULT NULL,
            completed_at TEXT DEFAULT NULL,
            error_message TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            job_id TEXT REFERENCES evaluation_jobs(id) ON DELETE SET NULL,
            week_id TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
            student_id TEXT NOT NULL,
            problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
            problem_number INTEGER NOT NULL,
            source_file TEXT NOT NULL,
            source_code TEXT DEFAULT '',
            verdict TEXT NOT NULL,
            passed_test_cases INTEGER DEFAULT 0,
            total_test_cases INTEGER DEFAULT 0,
            failed_test_case_number INTEGER DEFAULT NULL,
            total_time_ms REAL DEFAULT 0.0,
            max_time_ms REAL DEFAULT 0.0,
            compilation_success INTEGER DEFAULT 1,
            compilation_output TEXT DEFAULT '',
            compilation_errors_json TEXT DEFAULT '[]',
            test_results_json TEXT DEFAULT '[]',
            submitted_at TEXT NOT NULL,
            section TEXT DEFAULT 'Section A',
            UNIQUE(week_id, student_id, problem_number)
        );

        CREATE INDEX IF NOT EXISTS idx_problems_week ON problems(week_id);
        CREATE INDEX IF NOT EXISTS idx_submissions_week_student ON submissions(week_id, student_id);
        CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id);
        CREATE INDEX IF NOT EXISTS idx_submissions_job ON submissions(job_id);
        CREATE INDEX IF NOT EXISTS idx_students_week ON students(week_id);
        """)

        # Safe migrations for existing schemas
        for table, col_def in [
            ("students", "section TEXT DEFAULT 'Section A'"),
            ("submissions", "section TEXT DEFAULT 'Section A'"),
            ("evaluation_jobs", "section TEXT DEFAULT 'Section A'"),
        ]:
            try:
                if is_postgres_backend():
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col_def}")
                else:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_def}")
            except Exception:
                pass

        try:
            conn.execute("CREATE INDEX IF NOT EXISTS idx_students_section ON students(week_id, section)")
        except Exception:
            pass


# ==============================================================================
# --- Week Operations ---
# ==============================================================================

def create_week(week_number: int, title: str, description: str = "") -> WeekResponse:
    """Create a new Week entity."""
    week_id = f"week-{week_number:02d}"
    now = get_iso_now()

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO weeks (id, week_number, title, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'draft', ?, ?)
            """,
            (week_id, week_number, title, description, now, now),
        )

    return get_week(week_id)


def get_week_sections(week_id: str) -> List[str]:
    """Return all distinct class sections with students in a week."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT section FROM students WHERE week_id = ? AND section IS NOT NULL AND section != '' ORDER BY section ASC",
            (week_id,),
        ).fetchall()
        sections = [r["section"] for r in rows if r["section"]]
        if not sections:
            return ["Section A"]
        return sections


def get_week(week_id: str) -> Optional[WeekResponse]:
    """Retrieve a week and its problem/student counts and section list by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT w.*,
                   (SELECT COUNT(*) FROM problems p WHERE p.week_id = w.id) AS problem_count,
                   (SELECT COUNT(*) FROM students s WHERE s.week_id = w.id) AS student_count
            FROM weeks w
            WHERE w.id = ?
            """,
            (week_id,),
        ).fetchone()

        if not row:
            return None

        sections = get_week_sections(week_id)

        return WeekResponse(
            id=row["id"],
            week_number=row["week_number"],
            title=row["title"],
            description=row["description"],
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            problem_count=row["problem_count"],
            student_count=row["student_count"],
            sections=sections,
        )


def list_weeks() -> List[WeekResponse]:
    """List all registered weeks sorted by week number."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT w.*,
                   (SELECT COUNT(*) FROM problems p WHERE p.week_id = w.id) AS problem_count,
                   (SELECT COUNT(*) FROM students s WHERE s.week_id = w.id) AS student_count
            FROM weeks w
            ORDER BY w.week_number ASC
            """
        ).fetchall()

        return [
            WeekResponse(
                id=r["id"],
                week_number=r["week_number"],
                title=r["title"],
                description=r["description"],
                status=r["status"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                problem_count=r["problem_count"],
                student_count=r["student_count"],
                sections=get_week_sections(r["id"]),
            )
            for r in rows
        ]


def update_week(
    week_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
) -> Optional[WeekResponse]:
    """Update fields on a Week entity."""
    updates = []
    params = []

    if title is not None:
        updates.append("title = ?")
        params.append(title)
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if status is not None:
        updates.append("status = ?")
        params.append(status)

    if not updates:
        return get_week(week_id)

    updates.append("updated_at = ?")
    params.append(get_iso_now())
    params.append(week_id)

    with get_db_connection() as conn:
        conn.execute(
            f"UPDATE weeks SET {', '.join(updates)} WHERE id = ?",
            params,
        )

    return get_week(week_id)


def delete_week(week_id: str) -> bool:
    """Delete a week and cascade delete all problems, submissions, and students."""
    with get_db_connection() as conn:
        cursor = conn.execute("DELETE FROM weeks WHERE id = ?", (week_id,))
        return cursor.rowcount > 0


# ==============================================================================
# --- Problem Operations ---
# ==============================================================================

def save_problem(problem: ProblemInPack) -> ProblemInPack:
    """Insert or update a problem in a week's problem pack using ANSI ON CONFLICT."""
    now = get_iso_now()
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO problems (
                id, week_id, number, title, slug, description,
                input_format, output_format, constraints_json, difficulty,
                topics_json, hints_json, time_limit, public_test_cases_json,
                hidden_test_cases_json, reference_solution_c, is_verified,
                verification_report_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                week_id = EXCLUDED.week_id,
                number = EXCLUDED.number,
                title = EXCLUDED.title,
                slug = EXCLUDED.slug,
                description = EXCLUDED.description,
                input_format = EXCLUDED.input_format,
                output_format = EXCLUDED.output_format,
                constraints_json = EXCLUDED.constraints_json,
                difficulty = EXCLUDED.difficulty,
                topics_json = EXCLUDED.topics_json,
                hints_json = EXCLUDED.hints_json,
                time_limit = EXCLUDED.time_limit,
                public_test_cases_json = EXCLUDED.public_test_cases_json,
                hidden_test_cases_json = EXCLUDED.hidden_test_cases_json,
                reference_solution_c = EXCLUDED.reference_solution_c,
                is_verified = EXCLUDED.is_verified,
                verification_report_json = EXCLUDED.verification_report_json,
                created_at = EXCLUDED.created_at
            """,
            (
                problem.id,
                problem.week_id,
                problem.number,
                problem.title,
                problem.slug,
                problem.description,
                problem.input_format or "",
                problem.output_format or "",
                json.dumps(problem.constraints),
                problem.difficulty,
                json.dumps(problem.topics),
                json.dumps(problem.hints),
                problem.time_limit,
                json.dumps([tc.model_dump() for tc in problem.public_test_cases]),
                json.dumps([tc.model_dump() for tc in problem.hidden_test_cases]),
                problem.reference_solution_c or "",
                1 if problem.is_verified else 0,
                json.dumps(problem.verification_report.model_dump()) if problem.verification_report else None,
                now,
            ),
        )
    return problem


def get_problem_by_id(problem_id: str) -> Optional[ProblemInPack]:
    """Retrieve a single problem by its ID."""
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM problems WHERE id = ?", (problem_id,)).fetchone()
        if not row:
            return None
        return _row_to_problem(row)


def get_week_problems(week_id: str) -> List[ProblemInPack]:
    """Retrieve all problems configured for a week, ordered P1..P10."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM problems WHERE week_id = ? ORDER BY number ASC",
            (week_id,),
        ).fetchall()
        return [_row_to_problem(r) for r in rows]


def _row_to_problem(row: Any) -> ProblemInPack:
    """Helper to convert a database row to a ProblemInPack model."""
    verif_json = row["verification_report_json"]
    verif_report = VerificationReport.model_validate_json(verif_json) if verif_json else None

    pub_cases = [TestCaseSchema(**tc) for tc in json.loads(row["public_test_cases_json"] or "[]")]
    hid_cases = [TestCaseSchema(**tc) for tc in json.loads(row["hidden_test_cases_json"] or "[]")]

    return ProblemInPack(
        id=row["id"],
        week_id=row["week_id"],
        number=row["number"],
        title=row["title"],
        slug=row["slug"],
        description=row["description"],
        difficulty=row["difficulty"],
        topics=json.loads(row["topics_json"] or "[]"),
        constraints=json.loads(row["constraints_json"] or "[]"),
        hints=json.loads(row["hints_json"] or "[]"),
        time_limit=row["time_limit"],
        input_format=row["input_format"],
        output_format=row["output_format"],
        public_test_cases=pub_cases,
        hidden_test_cases=hid_cases,
        reference_solution_c=row["reference_solution_c"],
        is_verified=bool(row["is_verified"]),
        verification_report=verif_report,
    )


def delete_week_problems(week_id: str) -> int:
    """Delete all problems configured for a week."""
    with get_db_connection() as conn:
        cursor = conn.execute("DELETE FROM problems WHERE week_id = ?", (week_id,))
        count = cursor.rowcount
        conn.execute(
            "UPDATE weeks SET status = 'draft', updated_at = ? WHERE id = ? AND status = 'ready'",
            (get_iso_now(), week_id),
        )
        return count


def delete_single_problem(week_id: str, problem_number_or_id: Any) -> bool:
    """Delete a single problem from a week by its problem number (int) or ID (str)."""
    with get_db_connection() as conn:
        if isinstance(problem_number_or_id, int) or (isinstance(problem_number_or_id, str) and str(problem_number_or_id).isdigit()):
            cursor = conn.execute(
                "DELETE FROM problems WHERE week_id = ? AND number = ?",
                (week_id, int(problem_number_or_id)),
            )
        else:
            cursor = conn.execute(
                "DELETE FROM problems WHERE week_id = ? AND id = ?",
                (week_id, str(problem_number_or_id)),
            )
        return cursor.rowcount > 0


# ==============================================================================
# --- Student Operations ---
# ==============================================================================

def register_student(week_id: str, student_id: str, name: str = "", section: str = "Section A") -> None:
    """Register a student ID in a week's roster with section classification."""
    now = get_iso_now()
    sec = section.strip() if section and section.strip() else "Section A"
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO students (id, week_id, name, section, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(week_id, id) DO UPDATE SET section = EXCLUDED.section
            """,
            (student_id, week_id, name, sec, now),
        )


def get_week_students(week_id: str, section: Optional[str] = None) -> List[str]:
    """Return student IDs registered for a week, optionally filtered by class section."""
    with get_db_connection() as conn:
        if section and section.lower() not in ("all", "all sections", ""):
            rows = conn.execute(
                "SELECT id FROM students WHERE week_id = ? AND section = ? ORDER BY id ASC",
                (week_id, section),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id FROM students WHERE week_id = ? ORDER BY id ASC",
                (week_id,),
            ).fetchall()
        return [r["id"] for r in rows]


# ==============================================================================
# --- Evaluation Jobs ---
# ==============================================================================

def create_evaluation_job(
    job_id: str,
    week_id: str,
    total_students: int,
    total_submissions: int,
    continue_on_error: bool = True,
    section: str = "Section A",
) -> Dict[str, Any]:
    """Create a new batch evaluation job in queued state."""
    now = get_iso_now()
    sec = section.strip() if section and section.strip() else "Section A"
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO evaluation_jobs (
                id, week_id, section, status, total_students, processed_students,
                total_submissions, processed_submissions, continue_on_error,
                created_at
            ) VALUES (?, ?, ?, 'queued', ?, 0, ?, 0, ?, ?)
            """,
            (
                job_id,
                week_id,
                sec,
                total_students,
                total_submissions,
                1 if continue_on_error else 0,
                now,
            ),
        )
    return get_evaluation_job(job_id)


def update_job_progress(
    job_id: str,
    status: Optional[str] = None,
    processed_students: Optional[int] = None,
    processed_submissions: Optional[int] = None,
    current_student: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """Update progress counters and status on a running evaluation job."""
    updates = []
    params = []

    if status is not None:
        updates.append("status = ?")
        params.append(status)
        if status == "running":
            updates.append("started_at = COALESCE(started_at, ?)")
            params.append(get_iso_now())
        elif status in ("completed", "failed"):
            updates.append("completed_at = ?")
            params.append(get_iso_now())

    if processed_students is not None:
        updates.append("processed_students = ?")
        params.append(processed_students)
    if processed_submissions is not None:
        updates.append("processed_submissions = ?")
        params.append(processed_submissions)
    if current_student is not None:
        updates.append("current_student = ?")
        params.append(current_student)
    if error_message is not None:
        updates.append("error_message = ?")
        params.append(error_message)

    if not updates:
        return

    params.append(job_id)
    with get_db_connection() as conn:
        conn.execute(
            f"UPDATE evaluation_jobs SET {', '.join(updates)} WHERE id = ?",
            params,
        )


def get_evaluation_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve full details of an evaluation job."""
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM evaluation_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return None

        total_subs = row["total_submissions"] or 0
        proc_subs = row["processed_submissions"] or 0
        pct = round((proc_subs / total_subs * 100), 1) if total_subs > 0 else 0.0

        section_val = row["section"] if "section" in row.keys() and row["section"] else "Section A"

        return {
            "job_id": row["id"],
            "week_id": row["week_id"],
            "section": section_val,
            "status": row["status"],
            "total_students": row["total_students"],
            "processed_students": row["processed_students"],
            "total_submissions": row["total_submissions"],
            "processed_submissions": row["processed_submissions"],
            "current_student": row["current_student"],
            "continue_on_error": bool(row["continue_on_error"]),
            "created_at": row["created_at"],
            "started_at": row["started_at"],
            "completed_at": row["completed_at"],
            "error_message": row["error_message"],
            "progress_percentage": pct,
        }


# ==============================================================================
# --- Submissions Operations ---
# ==============================================================================

def save_submission(
    submission_id: str,
    job_id: Optional[str],
    week_id: str,
    student_id: str,
    problem_id: str,
    problem_number: int,
    source_file: str,
    source_code: str,
    verdict: str,
    passed_test_cases: int,
    total_test_cases: int,
    failed_test_case_number: Optional[int],
    total_time_ms: float,
    max_time_ms: float,
    compilation_res: CompilationResult,
    test_results: List[TestCaseExecutionDetail],
    section: str = "Section A",
) -> None:
    """Save an evaluated student C program submission using ANSI ON CONFLICT."""
    now = get_iso_now()
    sec = section.strip() if section and section.strip() else "Section A"
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO submissions (
                id, job_id, week_id, student_id, problem_id, problem_number,
                source_file, source_code, verdict, passed_test_cases,
                total_test_cases, failed_test_case_number, total_time_ms,
                max_time_ms, compilation_success, compilation_output,
                compilation_errors_json, test_results_json, submitted_at, section
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                job_id = EXCLUDED.job_id,
                week_id = EXCLUDED.week_id,
                student_id = EXCLUDED.student_id,
                problem_id = EXCLUDED.problem_id,
                problem_number = EXCLUDED.problem_number,
                source_file = EXCLUDED.source_file,
                source_code = EXCLUDED.source_code,
                verdict = EXCLUDED.verdict,
                passed_test_cases = EXCLUDED.passed_test_cases,
                total_test_cases = EXCLUDED.total_test_cases,
                failed_test_case_number = EXCLUDED.failed_test_case_number,
                total_time_ms = EXCLUDED.total_time_ms,
                max_time_ms = EXCLUDED.max_time_ms,
                compilation_success = EXCLUDED.compilation_success,
                compilation_output = EXCLUDED.compilation_output,
                compilation_errors_json = EXCLUDED.compilation_errors_json,
                test_results_json = EXCLUDED.test_results_json,
                submitted_at = EXCLUDED.submitted_at,
                section = EXCLUDED.section
            """,
            (
                submission_id,
                job_id,
                week_id,
                student_id,
                problem_id,
                problem_number,
                source_file,
                source_code,
                verdict,
                passed_test_cases,
                total_test_cases,
                failed_test_case_number,
                total_time_ms,
                max_time_ms,
                1 if compilation_res.success else 0,
                compilation_res.compiler_output,
                json.dumps([e.model_dump() for e in compilation_res.errors]),
                json.dumps([tr.model_dump() for tr in test_results]),
                now,
                sec,
            ),
        )


def get_student_submission(
    week_id: str,
    student_id: str,
    problem_number_or_id: Any,
) -> Optional[StudentSubmissionDetail]:
    """Retrieve a specific student submission with full compilation diagnostics and test case results."""
    with get_db_connection() as conn:
        if isinstance(problem_number_or_id, int):
            row = conn.execute(
                """
                SELECT s.*, p.title as problem_title
                FROM submissions s
                JOIN problems p ON p.id = s.problem_id
                WHERE s.week_id = ? AND s.student_id = ? AND s.problem_number = ?
                """,
                (week_id, student_id, problem_number_or_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT s.*, p.title as problem_title
                FROM submissions s
                JOIN problems p ON p.id = s.problem_id
                WHERE s.week_id = ? AND s.student_id = ? AND (s.problem_id = ? OR p.slug = ?)
                """,
                (week_id, student_id, str(problem_number_or_id), str(problem_number_or_id)),
            ).fetchone()

        if not row:
            return None

        return _row_to_submission_detail(row)


def get_student_submissions(week_id: str, student_id: str) -> List[StudentSubmissionDetail]:
    """Retrieve all submissions for a given student in a week."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT s.*, p.title as problem_title
            FROM submissions s
            JOIN problems p ON p.id = s.problem_id
            WHERE s.week_id = ? AND s.student_id = ?
            ORDER BY s.problem_number ASC
            """,
            (week_id, student_id),
        ).fetchall()

        return [_row_to_submission_detail(r) for r in rows]


def get_student_summary(week_id: str, student_id: str) -> StudentSummaryItem:
    """Compute aggregated summary statistics for a student in a week with section info."""
    submissions = get_student_submissions(week_id, student_id)
    total_problems = 10
    solved_count = sum(1 for s in submissions if s.verdict == JudgeVerdict.ACCEPTED)
    ce_count = sum(1 for s in submissions if s.verdict == JudgeVerdict.COMPILATION_ERROR)
    wa_count = sum(1 for s in submissions if s.verdict == JudgeVerdict.WRONG_ANSWER)
    re_count = sum(1 for s in submissions if s.verdict == JudgeVerdict.RUNTIME_ERROR)
    tle_count = sum(1 for s in submissions if s.verdict == JudgeVerdict.TIME_LIMIT_EXCEEDED)
    not_sub_count = sum(1 for s in submissions if s.verdict == JudgeVerdict.NOT_SUBMITTED)

    times = [s.total_time_ms for s in submissions if s.total_time_ms > 0]
    avg_time = round(sum(times) / len(times), 2) if times else 0.0
    ac_rate = round((solved_count / total_problems * 100), 1)

    sec = "Section A"
    with get_db_connection() as conn:
        r = conn.execute("SELECT section FROM students WHERE week_id = ? AND id = ?", (week_id, student_id)).fetchone()
        if r and "section" in r.keys() and r["section"]:
            sec = r["section"]

    return StudentSummaryItem(
        student_id=student_id,
        week_id=week_id,
        section=sec,
        total_problems=total_problems,
        solved_count=solved_count,
        acceptance_rate=ac_rate,
        compilation_errors=ce_count,
        wrong_answers=wa_count,
        runtime_errors=re_count,
        tle_count=tle_count,
        not_submitted=not_sub_count,
        average_time_ms=avg_time,
    )


def list_week_student_summaries(week_id: str, section: Optional[str] = None) -> List[StudentSummaryItem]:
    """List summary statistics for all students registered in a week (optionally filtered by section)."""
    student_ids = get_week_students(week_id, section=section)
    return [get_student_summary(week_id, sid) for sid in student_ids]


def _row_to_submission_detail(row: Any) -> StudentSubmissionDetail:
    """Helper to convert submission row to StudentSubmissionDetail."""
    errors_raw = json.loads(row["compilation_errors_json"] or "[]")
    errors = [CompilationDiagnostic(**e) for e in errors_raw]

    tests_raw = json.loads(row["test_results_json"] or "[]")
    tests = [TestCaseExecutionDetail(**t) for t in tests_raw]

    comp_res = CompilationResult(
        success=bool(row["compilation_success"]),
        exit_code=0 if row["compilation_success"] else 1,
        stdout="",
        stderr="",
        compiler_output=row["compilation_output"] or "",
        errors=errors,
    )

    section_val = row["section"] if "section" in row.keys() and row["section"] else "Section A"

    return StudentSubmissionDetail(
        submission_id=row["id"],
        problem_id=row["problem_id"],
        problem_number=row["problem_number"],
        problem_title=row["problem_title"],
        section=section_val,
        verdict=JudgeVerdict(row["verdict"]),
        source_file=row["source_file"],
        source_code=row["source_code"] or "",
        passed_test_cases=row["passed_test_cases"],
        total_test_cases=row["total_test_cases"],
        total_time_ms=row["total_time_ms"],
        compilation=comp_res,
        test_results=tests,
        submitted_at=row["submitted_at"],
    )


# Automatically initialize schema on module import
init_db()
