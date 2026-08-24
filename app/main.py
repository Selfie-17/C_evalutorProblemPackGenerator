from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.models import ExecuteCodeRequest, ExecuteCodeResponse, HealthResponse
from app.services.compiler import compile_and_run_c, get_compiler_health

app = FastAPI(
    title="C Code Execution Engine API",
    description="A high-performance LeetCode-style C compilation and execution engine powered by MSYS64 GCC.",
    version="1.0.0",
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
        "name": "C Code Execution Engine API",
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
            "execute": "POST /api/run",
            "health": "GET /health",
        },
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Check GCC compiler availability and system health."""
    return get_compiler_health()


@app.post(
    "/api/run",
    response_model=ExecuteCodeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Execution"],
    summary="Compile and Run C Code",
    description="Receives C source code and optional standard input (stdin), compiles via GCC, executes the binary, and returns execution metrics and output.",
)
def run_c_code(request: ExecuteCodeRequest) -> ExecuteCodeResponse:
    """
    Main endpoint for LeetCode-style C execution:
    - Code is compiled in an isolated directory
    - stdin is passed to the binary
    - stdout, stderr, execution time, and exit codes are returned
    - Timeouts forcefully terminate the process tree
    """
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
            detail=f"Unexpected engine failure: {str(e)}",
        )


# Alias endpoint for convenience
@app.post(
    "/run",
    response_model=ExecuteCodeResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def run_c_code_alias(request: ExecuteCodeRequest) -> ExecuteCodeResponse:
    return run_c_code(request)
