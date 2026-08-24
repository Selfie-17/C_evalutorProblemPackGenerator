from typing import List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    ExecuteCodeRequest,
    ExecuteCodeResponse,
    GenerateProblemRequest,
    GenerateProblemResponse,
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
from app.problems import get_problem, list_problems
from app.services.compiler import compile_and_run_c, get_compiler_health
from app.services.generator import check_llm_status, generate_problem_from_llm
from app.services.judge import judge_solution, run_custom_testcases

app = FastAPI(
    title="LeetCode-Style C Code Judge Engine & Problem Generator API",
    description="A high-performance C compilation, execution, online judging, and Local LLM problem generation backend powered by MSYS64 GCC and Ollama.",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Info"])
def root():
    """Welcome endpoint with API status and documentation link."""
    return {
        "name": "LeetCode-Style C Code Judge & Generator API",
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
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
