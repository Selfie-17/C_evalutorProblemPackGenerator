from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    SUCCESS = "success"
    COMPILATION_ERROR = "compilation_error"
    RUNTIME_ERROR = "runtime_error"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    INTERNAL_ERROR = "internal_error"


class JudgeStatus(str, Enum):
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    COMPILATION_ERROR = "compilation_error"
    RUNTIME_ERROR = "runtime_error"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    INTERNAL_ERROR = "internal_error"


class DifficultyEnum(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class JudgeVerdict(str, Enum):
    ACCEPTED = "ACCEPTED"
    WRONG_ANSWER = "WRONG_ANSWER"
    COMPILATION_ERROR = "COMPILATION_ERROR"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED"
    NOT_SUBMITTED = "NOT_SUBMITTED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class CompilationDiagnostic(BaseModel):
    line: Optional[int] = Field(default=None, description="1-based source code line number")
    column: Optional[int] = Field(default=None, description="1-based column number")
    message: str = Field(..., description="Compiler error, warning, or diagnostic text")
    severity: str = Field(default="error", description="Diagnostic severity: error, warning, or note")
    source_context: Optional[str] = Field(default=None, description="Snippet of source code context around error")


class CompilationResult(BaseModel):
    success: bool = Field(..., description="True if compiler produced an executable binary with exit code 0")
    exit_code: int = Field(default=0, description="GCC exit code")
    stdout: str = Field(default="", description="Compiler stdout")
    stderr: str = Field(default="", description="Compiler stderr")
    compiler_output: str = Field(default="", description="Full raw GCC compiler output")
    errors: List[CompilationDiagnostic] = Field(default_factory=list, description="Parsed structured error diagnostics")


# --- Raw Execution Models (/api/run) ---

class ExecuteCodeRequest(BaseModel):
    code: str = Field(
        ...,
        description="C source code to compile and execute",
        min_length=1,
        max_length=65536,
        examples=[
            '#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("Sum = %d\\n", a + b);\n    }\n    return 0;\n}'
        ],
    )
    stdin: Optional[str] = Field(
        default="",
        description="Standard input (stdin) passed to the compiled program",
        max_length=262144,
        examples=["10 20"],
    )
    timeout: Optional[float] = Field(
        default=5.0,
        ge=0.1,
        le=15.0,
        description="Maximum execution time limit in seconds (between 0.1 and 15.0)",
        examples=[5.0],
    )


class ExecuteCodeResponse(BaseModel):
    status: ExecutionStatus = Field(
        ...,
        description="Overall execution status: success, compilation_error, runtime_error, time_limit_exceeded, internal_error",
    )
    stdout: str = Field(
        default="",
        description="Standard output produced by the program",
    )
    stderr: str = Field(
        default="",
        description="Standard error produced by the program during execution",
    )
    exit_code: Optional[int] = Field(
        default=None,
        description="Exit status code of the executable (0 means normal completion)",
    )
    compilation_output: str = Field(
        default="",
        description="Compiler output, warnings, or compilation error messages",
    )
    diagnostics: List[CompilationDiagnostic] = Field(
        default_factory=list,
        description="Parsed structured compilation errors and warnings",
    )
    execution_time_ms: float = Field(
        default=0.0,
        description="Wall-clock execution time in milliseconds",
    )


# --- Judge Submission Models (/api/submit) ---

class SubmitCodeRequest(BaseModel):
    problem_id: str = Field(
        ...,
        description="Unique problem identifier (e.g., 'sum-two-numbers')",
        examples=["sum-two-numbers"],
    )
    code: str = Field(
        ...,
        description="C source code submitted to solve the problem",
        min_length=1,
        max_length=65536,
        examples=[
            '#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d", a + b);\n    }\n    return 0;\n}'
        ],
    )
    timeout: Optional[float] = Field(
        default=None,
        ge=0.1,
        le=15.0,
        description="Optional custom timeout in seconds (cannot exceed problem limit)",
        examples=[2.0],
    )


class SubmitCodeResponse(BaseModel):
    status: JudgeStatus = Field(
        ...,
        description="Judge verdict: accepted, wrong_answer, compilation_error, runtime_error, time_limit_exceeded, internal_error",
    )
    problem_id: str = Field(
        ...,
        description="The problem ID that was tested",
    )
    total_test_cases: int = Field(
        default=0,
        description="Total number of test cases configured for this problem",
    )
    passed_test_cases: int = Field(
        default=0,
        description="Number of test cases successfully passed",
    )
    failed_test_case: Optional[int] = Field(
        default=None,
        description="1-based index of the first failed test case (if any)",
    )
    input: Optional[str] = Field(
        default=None,
        description="Standard input of the failed test case (hidden for private test cases)",
    )
    expected_output: Optional[str] = Field(
        default=None,
        description="Expected standard output (hidden for private test cases)",
    )
    actual_output: Optional[str] = Field(
        default=None,
        description="Actual standard output produced by solution (hidden for private test cases)",
    )
    compilation_output: str = Field(
        default="",
        description="Compiler output/errors if compilation failed",
    )
    compilation_diagnostics: List[CompilationDiagnostic] = Field(
        default_factory=list,
        description="Parsed structured compiler diagnostics",
    )
    stderr: str = Field(
        default="",
        description="Standard error details if runtime error occurred",
    )
    total_execution_time_ms: float = Field(
        default=0.0,
        description="Sum of execution times across all run test cases in milliseconds",
    )
    max_execution_time_ms: float = Field(
        default=0.0,
        description="Peak execution time among all run test cases in milliseconds",
    )


# --- Custom Test Cases Models (/api/test) ---

class CustomTestCase(BaseModel):
    input: str = Field(
        default="",
        description="Standard input passed to program",
        examples=["10 20"],
    )
    expected_output: Optional[str] = Field(
        default=None,
        description="Optional expected output to compare against",
        examples=["30"],
    )


class RunCustomTestCasesRequest(BaseModel):
    code: str = Field(
        ...,
        description="C source code to compile once and run against test cases",
        min_length=1,
        max_length=65536,
    )
    test_cases: List[CustomTestCase] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of custom test cases to execute against the compiled binary",
    )
    timeout: Optional[float] = Field(
        default=5.0,
        ge=0.1,
        le=15.0,
        description="Execution timeout in seconds per test case",
    )


class TestCaseExecutionResult(BaseModel):
    test_case_number: int
    input: str
    expected_output: Optional[str] = None
    actual_output: str
    passed: Optional[bool] = None
    status: str  # "success", "wrong_answer", "time_limit_exceeded", "runtime_error"
    exit_code: Optional[int] = None
    stderr: str = ""
    execution_time_ms: float = 0.0


class RunCustomTestCasesResponse(BaseModel):
    status: str
    total_test_cases: int
    passed_test_cases: int
    compilation_output: str = ""
    results: List[TestCaseExecutionResult] = Field(default_factory=list)
    total_execution_time_ms: float = 0.0


# --- Problem Models & Discovery (/api/problems) ---

class SampleTestCaseModel(BaseModel):
    input: str
    expected_output: str


class ProblemSummary(BaseModel):
    id: str
    title: str
    time_limit: float
    difficulty: Optional[str] = "Easy"
    topics: List[str] = Field(default_factory=list)


class ProblemDetail(BaseModel):
    id: str
    title: str
    description: str
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: List[str] = Field(default_factory=list)
    time_limit: float
    difficulty: Optional[str] = "Easy"
    topics: List[str] = Field(default_factory=list)
    sample_cases: List[SampleTestCaseModel] = Field(default_factory=list)
    hints: List[str] = Field(default_factory=list)
    total_test_cases: int


from pydantic import BaseModel, Field, field_validator, model_validator


# --- Local LLM Problem Generator Models (/api/generate-problem) ---

class ExampleCase(BaseModel):
    input: str = Field(..., description="Example stdin input")
    output: str = Field(..., description="Example stdout output")
    explanation: Optional[str] = Field(default=None, description="Optional explanation for the example")

    @model_validator(mode="before")
    @classmethod
    def normalize_keys(cls, data):
        if isinstance(data, dict):
            if "output" not in data and "expected_output" in data:
                data["output"] = data["expected_output"]
        return data


class TestCaseSchema(BaseModel):
    input: str = Field(..., description="Standard input string for testcase")
    expected_output: str = Field(..., description="Expected standard output string")

    @model_validator(mode="before")
    @classmethod
    def normalize_keys(cls, data):
        if isinstance(data, dict):
            if "expected_output" not in data and "output" in data:
                data["expected_output"] = data["output"]
        return data


class GeneratedProblemSchema(BaseModel):
    title: str = Field(..., description="Problem title")
    slug: str = Field(..., description="URL and lookup friendly unique identifier (e.g. 'find-maximum-element')")
    difficulty: str = Field(default="Easy", description="Difficulty level: Easy, Medium, or Hard")
    topics: List[str] = Field(default_factory=list, description="List of algorithm/data structure topic tags")
    description: str = Field(..., description="Clear problem statement and requirements")
    input_format: str = Field(..., description="Exact format of the standard input stream (e.g. 'First line contains integer N...')")
    output_format: str = Field(..., description="Exact format of standard output stream")
    examples: List[ExampleCase] = Field(default_factory=list, description="1 to 3 public examples with explanations")
    constraints: List[str] = Field(default_factory=list, description="Input value constraints (e.g. '1 <= N <= 10^5')")
    time_limit_seconds: float = Field(default=2.0, ge=0.5, le=10.0, description="Execution time limit per test case in seconds")
    memory_limit_mb: int = Field(default=256, description="Memory limit in megabytes")
    public_test_cases: List[TestCaseSchema] = Field(default_factory=list, description="Public test cases (sample cases)")
    hidden_test_cases: List[TestCaseSchema] = Field(default_factory=list, description="Hidden test cases for judging edge cases")
    reference_solution_c: Optional[str] = Field(default=None, description="Complete working C reference solution implementing scanf/printf")
    follow_up: Optional[str] = Field(default=None, description="Optional follow-up question")
    hints: List[str] = Field(default_factory=list, description="Optional hints for solving")

    @field_validator("reference_solution_c", mode="before")
    @classmethod
    def extract_c_code_string(cls, v):
        if isinstance(v, dict):
            return v.get("code") or v.get("solution") or str(v)
        return v


class GenerateProblemRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="Problem topic, prompt, or raw statement (e.g. 'Create an easy array problem about finding the largest number')",
        min_length=5,
        examples=["Create an easy array problem about finding the largest number."],
    )
    difficulty: Optional[DifficultyEnum] = Field(default=DifficultyEnum.EASY, description="Desired problem difficulty")
    topics: List[str] = Field(default_factory=list, description="Optional list of topic tags to guide generation")
    verify_with_reference: Optional[bool] = Field(default=True, description="Whether to compile and execute the generated reference C code against all test cases")
    provider: Optional[str] = Field(default="gemini", description="LLM provider: 'gemini' or 'ollama'")
    model: Optional[str] = Field(default=None, description="Optional LLM model override")
    api_key: Optional[str] = Field(default=None, description="Optional Gemini API Key")


class VerificationCaseResult(BaseModel):
    test_case_number: int
    is_hidden: bool
    input: str
    expected_output: str
    reference_output: str
    matched: bool
    status: str
    execution_time_ms: float = 0.0


class VerificationReport(BaseModel):
    compiled_successfully: bool
    compilation_output: str = ""
    total_test_cases: int = 0
    matched_test_cases: int = 0
    all_matched: bool = False
    details: List[VerificationCaseResult] = Field(default_factory=list)


class GenerateProblemResponse(BaseModel):
    status: str  # "success", "validation_failed", "verification_failed", "llm_error"
    problem: Optional[GeneratedProblemSchema] = None
    registered_problem_id: Optional[str] = None
    verification_report: Optional[VerificationReport] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    generation_time_ms: float = 0.0


# --- Health & LLM Status ---

class HealthResponse(BaseModel):
    status: str
    gcc_path: str
    gcc_available: bool
    gcc_version: Optional[str] = None
    compiler: Optional[str] = "gcc"
    available: Optional[bool] = None
    version: Optional[str] = None


class LLMStatusResponse(BaseModel):
    status: str  # "online", "offline"
    backend: str
    base_url: str
    configured_model: str
    available_models: List[str] = Field(default_factory=list)
    error: Optional[str] = None


# --- Personalized Viva Question Generator Models (/api/generate-viva) ---

class QuestionTypeEnum(str, Enum):
    MCQ = "mcq"
    DESCRIPTIVE = "descriptive"
    TRICKY = "tricky"
    CODE_MODIFICATION = "code_modification"
    DEBUGGING = "debugging"


class VivaQuestion(BaseModel):
    id: int = Field(..., description="1-based question sequence identifier")
    type: str = Field(
        ...,
        description="Question type: mcq, descriptive, tricky, code_modification, or debugging",
    )
    difficulty: str = Field(
        default="medium",
        description="Question difficulty: easy, medium, or hard",
    )
    category: str = Field(
        default="code_specific",
        description="Aspect analyzed: code_specific, why, edge_case, complexity, debugging, or what_if",
    )
    question: str = Field(..., description="The personalized interview or viva question")
    options: List[str] = Field(
        default_factory=list,
        description="List of 4 candidate answers for MCQ questions",
    )
    correct_answer: Optional[int] = Field(
        default=None,
        description="0-indexed or 1-indexed index of correct option for MCQ",
    )
    expected_answer: Optional[str] = Field(
        default=None,
        description="Detailed expected answer and rationale for descriptive/tricky/debugging questions",
    )
    explanation: Optional[str] = Field(
        default=None,
        description="Explanation of the correct answer and underlying concept",
    )
    related_code: Optional[str] = Field(
        default=None,
        description="Exact snippet from the student's submitted code targeted by this question",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_viva_question(cls, data):
        if isinstance(data, dict):
            # Normalize correct_answer if provided as string or 1-indexed
            ans = data.get("correct_answer")
            opts = data.get("options") or []
            if isinstance(ans, str) and opts:
                # If answer matches one of the options text
                for idx, opt in enumerate(opts):
                    if opt.strip().lower() == ans.strip().lower():
                        data["correct_answer"] = idx
                        break
            # If expected_answer is missing but explanation exists
            if not data.get("expected_answer") and data.get("explanation"):
                data["expected_answer"] = data["explanation"]
        return data


class GenerateVivaRequest(BaseModel):
    problem_id: Optional[str] = Field(
        default=None,
        description="Optional problem identifier to automatically resolve title, description, and constraints",
        examples=["sum-two-numbers"],
    )
    problem_title: Optional[str] = Field(
        default=None,
        description="Problem title (optional if problem_id is supplied)",
        examples=["Sum of Two Numbers"],
    )
    problem_description: Optional[str] = Field(
        default=None,
        description="Problem description (optional if problem_id is supplied)",
        examples=["Given two integers a and b, compute their sum."],
    )
    submitted_code: str = Field(
        ...,
        min_length=5,
        max_length=65536,
        description="The student's submitted C source code",
        examples=[
            '#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d\\n", a + b);\n    }\n    return 0;\n}'
        ],
    )
    judge_result: Optional[dict] = Field(
        default=None,
        description="Verdict dictionary from judge (e.g. status: 'accepted', 'wrong_answer', 'time_limit_exceeded', failed_test_case: 2, etc.)",
        examples=[{"status": "accepted", "total_test_cases": 5, "passed_test_cases": 5}],
    )
    number_of_questions: Optional[int] = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of personalized viva questions to generate (1 to 20)",
        examples=[5],
    )
    provider: Optional[str] = Field(
        default=None,
        description="LLM provider override: 'ollama' (local) or 'gemini' (cloud)",
        examples=["ollama"],
    )
    model: Optional[str] = Field(
        default=None,
        description="Specific model override (e.g. 'qwen2.5-coder:3b' or 'gemini-3.7-flash')",
        examples=["qwen2.5-coder:3b"],
    )


class GenerateVivaResponse(BaseModel):
    status: str  # "success", "validation_failed", "llm_error"
    provider_used: str
    model_used: str
    total_questions: int = 0
    questions: List[VivaQuestion] = Field(default_factory=list)
    code_summary: Optional[str] = None
    generation_time_ms: float = 0.0
    error: Optional[str] = None


# ==============================================================================
# --- C Lab Evaluation Platform Models ---
# ==============================================================================

class TestCaseSummary(BaseModel):
    total: int = 0
    passed: int = 0
    failed: int = 0


class ExecutionSummary(BaseModel):
    total_time_ms: float = 0.0
    max_time_ms: float = 0.0


class TestCaseExecutionDetail(BaseModel):
    test_case_number: int
    is_hidden: bool = False
    input: Optional[str] = None
    expected_output: Optional[str] = None
    actual_output: Optional[str] = None
    passed: bool = False
    status: str = "wrong_answer"
    exit_code: Optional[int] = None
    stderr: str = ""
    execution_time_ms: float = 0.0


class StandardizedJudgeResult(BaseModel):
    verdict: JudgeVerdict = JudgeVerdict.ACCEPTED
    test_cases: TestCaseSummary = Field(default_factory=TestCaseSummary)
    execution: ExecutionSummary = Field(default_factory=ExecutionSummary)
    compilation: CompilationResult
    failed_test_case: Optional[int] = None
    details: List[TestCaseExecutionDetail] = Field(default_factory=list)


# --- Week Models ---

class WeekCreateRequest(BaseModel):
    week_number: int = Field(..., ge=1, le=52, description="Week sequence number")
    title: str = Field(..., min_length=2, max_length=120, description="Week title e.g. 'Basic C Programming'")
    description: Optional[str] = Field(default="", description="Optional description of the week lab objectives")


class WeekUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class WeekResponse(BaseModel):
    id: str
    week_number: int
    title: str
    description: str
    status: str
    created_at: str
    updated_at: str
    problem_count: int = 0
    student_count: int = 0
    sections: List[str] = Field(default_factory=list)


# --- Problem Pack Models ---

class ProblemInPack(BaseModel):
    id: str
    week_id: str
    number: int
    title: str
    slug: str
    description: str
    difficulty: str = "Easy"
    topics: List[str] = Field(default_factory=list)
    constraints: List[str] = Field(default_factory=list)
    hints: List[str] = Field(default_factory=list)
    time_limit: float = 2.0
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    public_test_cases: List[TestCaseSchema] = Field(default_factory=list)
    hidden_test_cases: List[TestCaseSchema] = Field(default_factory=list)
    reference_solution_c: Optional[str] = None
    is_verified: bool = False
    verification_report: Optional[VerificationReport] = None


class GeneratePackRequest(BaseModel):
    number_of_problems: int = Field(default=10, ge=1, le=15, description="Number of problems to generate (default 10)")
    difficulty: str = Field(default="Easy", description="Overall difficulty (Easy, Medium, Hard)")
    topics: List[str] = Field(default_factory=list, description="Target topics (e.g. ['loops', 'conditions', 'arrays'])")
    verify_with_reference: bool = Field(default=True, description="Verify reference C solution against test cases")
    provider: Optional[str] = Field(default="gemini", description="LLM provider: 'gemini' or 'ollama'")
    model: Optional[str] = Field(default="gemini-3.8-flash", description="Model override (e.g. 'gemini-3.8-flash', 'gemini-3.7-flash', or 'qwen2.5-coder:3b')")
    api_key: Optional[str] = Field(default=None, description="Optional API key for Gemini")


class GenerateFromQuestionsRequest(BaseModel):
    raw_text: Optional[str] = Field(
        default=None,
        description="Raw multiline text of questions (e.g. 1. Write a C program to ... \n 2. Write a C program to ...)",
    )
    questions: List[str] = Field(
        default_factory=list,
        description="Explicit list of question prompts",
    )
    difficulty: Optional[str] = Field(default=None, description="Optional difficulty override; defaults to model classification")
    verify_with_reference: bool = Field(default=True, description="Verify reference C solution with GCC compiler")
    provider: Optional[str] = Field(default="gemini", description="LLM provider: 'gemini' or 'ollama'")
    model: Optional[str] = Field(default="gemini-3.8-flash", description="Model override (e.g. 'gemini-3.8-flash', 'gemini-3.7-flash', or 'qwen2.5-coder:3b')")
    api_key: Optional[str] = Field(default=None, description="Optional API key for Gemini")
    replace_all: bool = Field(default=False, description="Whether to replace all existing problems in the week (default: False, appends)")


class GeneratePackResponse(BaseModel):
    week_id: str
    status: str
    total_generated: int = 0
    total_verified: int = 0
    problems: List[ProblemInPack] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


# --- ZIP Validation Models ---

class StudentProgramValidationItem(BaseModel):
    problem_number: int
    found: bool
    filename: Optional[str] = None


class StudentValidationItem(BaseModel):
    student_id: str
    total_found: int
    missing_count: int
    programs: List[StudentProgramValidationItem] = Field(default_factory=list)


class ZipValidationReport(BaseModel):
    staging_token: str
    zip_filename: str
    section: str = Field(default="Section A", description="Target class section (e.g. Section A, Section B)")
    total_students: int
    total_expected_programs: int
    total_found_programs: int
    total_missing_programs: int
    students: List[StudentValidationItem] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# --- Evaluation Job Models ---

class EvaluationJobStartRequest(BaseModel):
    week_id: str
    staging_token: str
    section: Optional[str] = Field(default="Section A", description="Target class section being evaluated")
    continue_on_error: bool = Field(default=True, description="Proceed with remaining programs even if one fails")


class EvaluationJobResponse(BaseModel):
    job_id: str
    week_id: str
    section: Optional[str] = "Section A"
    status: str  # "queued", "running", "completed", "failed"
    total_students: int = 0
    processed_students: int = 0
    total_submissions: int = 0
    processed_submissions: int = 0
    current_student: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    progress_percentage: float = 0.0


# --- Student & Submission Detail Models ---

class StudentSubmissionDetail(BaseModel):
    submission_id: str
    problem_id: str
    problem_number: int
    problem_title: str
    section: Optional[str] = "Section A"
    verdict: JudgeVerdict
    source_file: str
    source_code: str
    passed_test_cases: int
    total_test_cases: int
    total_time_ms: float
    compilation: CompilationResult
    test_results: List[TestCaseExecutionDetail] = Field(default_factory=list)
    submitted_at: str


class StudentSummaryItem(BaseModel):
    student_id: str
    week_id: str
    section: Optional[str] = "Section A"
    total_problems: int = 10
    solved_count: int = 0
    acceptance_rate: float = 0.0
    compilation_errors: int = 0
    wrong_answers: int = 0
    runtime_errors: int = 0
    tle_count: int = 0
    not_submitted: int = 0
    average_time_ms: float = 0.0


class StudentDetailResponse(BaseModel):
    student_id: str
    week_id: str
    week_number: int
    section: Optional[str] = "Section A"
    summary: StudentSummaryItem
    submissions: List[StudentSubmissionDetail] = Field(default_factory=list)


# --- Analytics Models ---

class VerdictDistribution(BaseModel):
    accepted: int = 0
    wrong_answer: int = 0
    compilation_error: int = 0
    runtime_error: int = 0
    time_limit_exceeded: int = 0
    not_submitted: int = 0


class ProblemAnalyticsItem(BaseModel):
    problem_number: int
    problem_id: str
    title: str
    difficulty: str
    total_submissions: int = 0
    accepted_count: int = 0
    wrong_answer_count: int = 0
    compilation_error_count: int = 0
    runtime_error_count: int = 0
    tle_count: int = 0
    acceptance_rate: float = 0.0
    avg_time_ms: float = 0.0


class WeekAnalyticsResponse(BaseModel):
    week_id: str
    week_number: int
    title: str
    section: Optional[str] = None  # None for consolidated all sections, or 'Section A'
    available_sections: List[str] = Field(default_factory=list)
    total_students: int = 0
    total_programs: int = 0
    verdicts: VerdictDistribution = Field(default_factory=VerdictDistribution)
    overall_acceptance_rate: float = 0.0
    avg_test_cases_passed_pct: float = 0.0
    avg_execution_time_ms: float = 0.0
    problem_stats: List[ProblemAnalyticsItem] = Field(default_factory=list)
    top_students: List[str] = Field(default_factory=list)
    struggling_students: List[str] = Field(default_factory=list)

