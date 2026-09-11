from typing import List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    ExecuteCodeRequest,
    ExecuteCodeResponse,
    GenerateProblemRequest,
    GenerateProblemResponse,
    GenerateVivaRequest,
    GenerateVivaResponse,
    HealthResponse,
    LLMStatusResponse,
    ProblemDetail,
    ProblemSummary,
    RunCustomTestCasesRequest,
    RunCustomTestCasesResponse,
    SampleTestCaseModel,
    SubmitCodeRequest,
    SubmitCodeResponse,
)
from app.api.analytics import router as analytics_router
from app.api.evaluations import router as evaluations_router
from app.api.problem_engine import router as problem_engine_router
from app.api.students import router as students_router
from app.api.weeks import router as weeks_router
from app.database.db import init_db
from app.problems import get_problem, list_problems
from app.services.compiler import compile_and_run_c, get_compiler_health
from app.services.generator import check_llm_status, generate_problem_from_llm
from app.services.judge import judge_solution, run_custom_testcases
from app.services.viva import generate_viva_questions

from app.config import FRONTEND_URL

# Initialize database schema on startup
init_db()

app = FastAPI(
    title="C Lab Evaluation Platform & LeetCode Judge API",
    description="A high-performance C compilation, execution, batch lab evaluation, problem pack generator, and analytics engine powered by Linux GCC and SQLite/PostgreSQL.",
    version="4.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS origins (supporting local dev and configured Vercel frontend)
cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

if FRONTEND_URL:
    for origin in FRONTEND_URL.split(","):
        origin_clean = origin.strip().rstrip("/")
        if origin_clean and origin_clean not in cors_origins:
            cors_origins.append(origin_clean)
else:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app" if FRONTEND_URL else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register C Lab Evaluation Platform routers
app.include_router(weeks_router)
app.include_router(evaluations_router)
app.include_router(students_router)
app.include_router(analytics_router)
app.include_router(problem_engine_router)


@app.get("/", tags=["Info"])
def root():
    """Welcome endpoint with API status and documentation link."""
    return {
        "name": "LeetCode-Style C Code Judge, Generator & Viva API",
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
            "generate_viva": "POST /api/generate-viva",
            "generate_problem": "POST /api/generate-problem",
            "llm_status": "GET /api/llm/status",
            "problems": "GET /api/problems",
            "submit": "POST /api/submit",
            "test_custom": "POST /api/test",
            "execute_raw": "POST /api/run",
            "health": "GET /health",
        },
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Check GCC compiler availability and system health."""
    return get_compiler_health()


@app.get("/api/llm/status", response_model=LLMStatusResponse, tags=["Local LLM"])
async def get_llm_status():
    """Check local Ollama / LLM server connectivity and installed models."""
    return await check_llm_status()


# --- Personalized Viva Question Generation Endpoint ---

@app.post(
    "/api/generate-viva",
    response_model=GenerateVivaResponse,
    status_code=status.HTTP_200_OK,
    tags=["Viva Generator"],
    summary="Generate Personalized Viva / Interview Questions",
    description="Analyzes submitted C code, problem statement, and judge execution verdict to generate targeted viva questions (MCQ, Descriptive Why, Tricky Edge-cases, Debugging, Code Modification). Supports local Ollama and Google Gemini providers.",
)
async def generate_viva(request: GenerateVivaRequest) -> GenerateVivaResponse:
    """
    Personalized Viva Generation:
    1. Inspects student code decisions (variables, loops, conditions, memory).
    2. Incorporates judge verdict (Accepted, Wrong Answer, TLE, Runtime Error).
    3. Queries selected provider (Ollama local or Gemini cloud).
    4. Validates and returns structured viva questions with code snippets.
    """
    response = await generate_viva_questions(request)
    return response


# --- Problem Generation Endpoints ---

@app.post(
    "/api/generate-problem",
    response_model=GenerateProblemResponse,
    status_code=status.HTTP_200_OK,
    tags=["Local LLM"],
    summary="Generate a New Problem Using Local LLM",
    description="Uses local Ollama LLM to generate a complete structured LeetCode-style C problem, validates JSON schema, verifies test cases via reference C solution execution, and stores it in the database.",
)
async def generate_problem(request: GenerateProblemRequest) -> GenerateProblemResponse:
    """
    Generate, Validate, Verify, and Store Problem:
    1. Sends prompt to local LLM with strict JSON schema.
    2. Validates JSON via Pydantic.
    3. Compiles generated reference C code and runs against all test cases.
    4. Registers problem into judge database and persists to data/problems.json.
    """
    response = await generate_problem_from_llm(request)
    return response


# --- Problems Endpoints ---

@app.get(
    "/api/problems",
    response_model=List[ProblemSummary],
    tags=["Problems"],
    summary="List all available problems",
)
def get_all_problems() -> List[ProblemSummary]:
    """Retrieve list of all coding problems available on the platform."""
    problems = list_problems()
    return [
        ProblemSummary(
            id=p.id,
            title=p.title,
            time_limit=p.time_limit,
            difficulty=p.difficulty,
            topics=p.topics,
        )
        for p in problems
    ]


@app.get(
    "/api/problems/{problem_id}",
    response_model=ProblemDetail,
    tags=["Problems"],
    summary="Get problem details and sample test cases",
)
def get_problem_details(problem_id: str) -> ProblemDetail:
    """Retrieve problem description, time limit, and public sample test cases."""
    problem = get_problem(problem_id)
    if not problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem '{problem_id}' was not found.",
        )
    return ProblemDetail(
        id=problem.id,
        title=problem.title,
        description=problem.description,
        input_format=problem.input_format,
        output_format=problem.output_format,
        constraints=problem.constraints,
        difficulty=problem.difficulty,
        topics=problem.topics,
        hints=problem.hints,
        time_limit=problem.time_limit,
        sample_cases=[
            SampleTestCaseModel(
                input=tc.input,
                expected_output=tc.expected_output,
            )
            for tc in problem.sample_cases
        ],
        total_test_cases=len(problem.all_test_cases),
    )


# --- Raw Execution Endpoint ---

@app.post(
    "/api/run",
    response_model=ExecuteCodeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Execution"],
    summary="Compile and Run Raw C Code (Single Run)",
    description="Receives arbitrary C source code and optional standard input (stdin), compiles via GCC, executes the binary once, and returns output.",
)
def run_c_code(request: ExecuteCodeRequest) -> ExecuteCodeResponse:
    """Raw compilation and single execution endpoint."""
    try:
        response = compile_and_run_c(
            code=request.code,
            stdin_input=request.stdin or "",
            timeout_seconds=request.timeout or 5.0,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution engine failure: {str(e)}",
        )


@app.post(
    "/run",
    response_model=ExecuteCodeResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def run_c_code_alias(request: ExecuteCodeRequest) -> ExecuteCodeResponse:
    return run_c_code(request)


# --- Custom Test Cases Execution Endpoint ---

@app.post(
    "/api/test",
    response_model=RunCustomTestCasesResponse,
    status_code=status.HTTP_200_OK,
    tags=["Execution"],
    summary="Compile Once and Run Against Custom Test Cases",
    description="Compiles C code once and runs it against an array of user-provided custom test cases with expected outputs, returning per-case results.",
)
def run_test_cases(request: RunCustomTestCasesRequest) -> RunCustomTestCasesResponse:
    """
    Run Code against custom test cases:
    - Compiles code once
    - Executes binary against every supplied testcase in request
    - Compares with expected_output if provided
    - Returns detailed results for each test case
    """
    try:
        response = run_custom_testcases(
            code=request.code,
            test_cases=request.test_cases,
            timeout_seconds=request.timeout or 5.0,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test runner engine failure: {str(e)}",
        )


@app.post(
    "/api/run-testcases",
    response_model=RunCustomTestCasesResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def run_test_cases_alias(request: RunCustomTestCasesRequest) -> RunCustomTestCasesResponse:
    return run_test_cases(request)


# --- LeetCode-Style Judge Submission Endpoint ---

@app.post(
    "/api/submit",
    response_model=SubmitCodeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Judge"],
    summary="Submit C Code Solution Against Problem Test Cases",
    description="Compiles submitted C code once and sequentially evaluates it against all test cases (sample and hidden), returning verdict: ACCEPTED, WRONG_ANSWER, TLE, or RUNTIME_ERROR.",
)
def submit_solution(request: SubmitCodeRequest) -> SubmitCodeResponse:
    """
    Judge Endpoint:
    - Verifies problem exists
    - Compiles code once
    - Evaluates test cases sequentially
    - Hides sensitive inputs/outputs for private test cases
    - Stops on first failure
    """
    problem = get_problem(request.problem_id)
    if not problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem '{request.problem_id}' does not exist.",
        )

    try:
        verdict = judge_solution(
            problem_id=request.problem_id,
            code=request.code,
            custom_timeout=request.timeout,
        )
        return verdict
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Judge system failure: {str(e)}",
        )
