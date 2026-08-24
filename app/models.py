from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    SUCCESS = "success"
    COMPILATION_ERROR = "compilation_error"
    RUNTIME_ERROR = "runtime_error"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    INTERNAL_ERROR = "internal_error"


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
    execution_time_ms: float = Field(
        default=0.0,
        description="Wall-clock execution time in milliseconds",
    )


class HealthResponse(BaseModel):
    status: str
    gcc_path: str
    gcc_available: bool
    gcc_version: Optional[str] = None
