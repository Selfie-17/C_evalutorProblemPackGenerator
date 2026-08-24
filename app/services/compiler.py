import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Tuple

from app.config import (
    COMPILER_FLAGS,
    DEFAULT_TIMEOUT_SECONDS,
    GCC_EXECUTABLE_PATH,
    MAX_TIMEOUT_SECONDS,
    get_compiler_env,
)
from app.models import ExecuteCodeResponse, ExecutionStatus, HealthResponse


def kill_process_tree(pid: int) -> None:
    """
    Forcefully terminate a process and all of its spawned child processes.
    Uses Windows 'taskkill /F /T /PID' command to ensure entire process tree cleanup.
    """
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
        else:
            # Fallback for non-Windows environments
            import signal

            os.killpg(os.getpgid(pid), signal.SIGKILL)
    except Exception:
        # Ignore errors if process already exited or PID is invalid
        pass


def get_gcc_version() -> Tuple[bool, str]:
    """Check if the configured GCC compiler is accessible and retrieve its version."""
    try:
        result = subprocess.run(
            [GCC_EXECUTABLE_PATH, "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=get_compiler_env(),
            timeout=5.0,
        )
        if result.returncode == 0:
            first_line = result.stdout.strip().split("\n")[0]
            return True, first_line
        return False, (result.stdout + result.stderr).strip() or f"Exited with code {result.returncode}"
    except Exception as e:
        return False, str(e)


def get_compiler_health() -> HealthResponse:
    """Return health status information about the compiler."""
    is_available, version_info = get_gcc_version()
    return HealthResponse(
        status="healthy" if is_available else "degraded",
        gcc_path=GCC_EXECUTABLE_PATH,
        gcc_available=is_available,
        gcc_version=version_info if is_available else None,
    )


def compile_and_run_c(
    code: str,
    stdin_input: str = "",
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> ExecuteCodeResponse:
    """
    Compiles and executes C code in an isolated temporary directory.

    Execution Flow:
    1. Create unique isolated temporary directory.
    2. Write code to 'solution.c'.
    3. Run GCC compiler with configured flags.
    4. If compilation fails -> Return COMPILATION_ERROR with compiler output.
    5. If compilation succeeds -> Run 'solution.exe', pipe stdin, capture stdout/stderr.
    6. If execution times out -> Kill entire process tree and return TIME_LIMIT_EXCEEDED.
    7. Return structured execution results (status, stdout, stderr, exit code, time).
    8. Auto-cleanup temporary directory.
    """
    # Enforce safe bounds on timeout
    effective_timeout = max(0.1, min(timeout_seconds, MAX_TIMEOUT_SECONDS))

    with tempfile.TemporaryDirectory(prefix="c_runner_") as temp_dir:
        temp_path = Path(temp_dir)
        source_file = temp_path / "solution.c"
        executable_file = temp_path / "solution.exe"

        # 1. Write source code to file
        try:
            source_file.write_text(code, encoding="utf-8")
        except Exception as e:
            return ExecuteCodeResponse(
                status=ExecutionStatus.INTERNAL_ERROR,
                stderr=f"Failed to write source code: {str(e)}",
                exit_code=-1,
            )

        runner_env = get_compiler_env(temp_dir)

        # 2. Compile source code using GCC
        compile_cmd = [
            GCC_EXECUTABLE_PATH,
            str(source_file),
            "-o",
            str(executable_file),
            *COMPILER_FLAGS,
        ]

        try:
            compile_proc = subprocess.run(
                compile_cmd,
                cwd=temp_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=runner_env,
                timeout=10.0,  # 10s compiler timeout
            )
        except subprocess.TimeoutExpired:
            return ExecuteCodeResponse(
                status=ExecutionStatus.COMPILATION_ERROR,
                compilation_output="Compilation timed out after 10 seconds.",
                exit_code=-1,
            )
        except Exception as e:
            return ExecuteCodeResponse(
                status=ExecutionStatus.INTERNAL_ERROR,
                compilation_output=f"Failed to invoke compiler: {str(e)}",
                exit_code=-1,
            )

        compilation_output = (compile_proc.stdout + compile_proc.stderr).strip()

        # Check if compilation failed
        if compile_proc.returncode != 0 or not executable_file.is_file():
            return ExecuteCodeResponse(
                status=ExecutionStatus.COMPILATION_ERROR,
                compilation_output=compilation_output or f"Compilation failed with exit code {compile_proc.returncode}.",
                exit_code=compile_proc.returncode,
                execution_time_ms=0.0,
            )

        # 3. Execute the compiled binary
        start_time = time.perf_counter()
        proc = None

        try:
            proc = subprocess.Popen(
                [str(executable_file)],
                cwd=temp_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=runner_env,
            )

            stdout_data, stderr_data = proc.communicate(
                input=stdin_input or None,
                timeout=effective_timeout,
            )
            end_time = time.perf_counter()
            elapsed_ms = round((end_time - start_time) * 1000, 2)

            status = (
                ExecutionStatus.SUCCESS
                if proc.returncode == 0
                else ExecutionStatus.RUNTIME_ERROR
            )

            return ExecuteCodeResponse(
                status=status,
                stdout=stdout_data,
                stderr=stderr_data,
                exit_code=proc.returncode,
                compilation_output=compilation_output,
                execution_time_ms=elapsed_ms,
            )

        except subprocess.TimeoutExpired:
            end_time = time.perf_counter()
            elapsed_ms = round((end_time - start_time) * 1000, 2)

            if proc:
                # Terminate the entire process tree on timeout
                kill_process_tree(proc.pid)
                try:
                    proc.kill()
                    proc.communicate(timeout=1.0)
                except Exception:
                    pass

            return ExecuteCodeResponse(
                status=ExecutionStatus.TIME_LIMIT_EXCEEDED,
                stdout="",
                stderr=f"Time limit exceeded ({effective_timeout:.2f}s). Execution killed.",
                exit_code=None,
                compilation_output=compilation_output,
                execution_time_ms=elapsed_ms,
            )

        except Exception as e:
            if proc:
                kill_process_tree(proc.pid)
                try:
                    proc.kill()
                except Exception:
                    pass

            return ExecuteCodeResponse(
                status=ExecutionStatus.INTERNAL_ERROR,
                stderr=f"Execution error: {str(e)}",
                exit_code=-1,
                compilation_output=compilation_output,
            )
