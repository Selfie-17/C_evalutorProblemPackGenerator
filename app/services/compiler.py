import os
import re
import subprocess
import tempfile
import time
from pathlib import Path
from typing import List, Optional, Tuple

from app.config import (
    COMPILER_FLAGS,
    DEFAULT_TIMEOUT_SECONDS,
    GCC_EXECUTABLE_PATH,
    MAX_TIMEOUT_SECONDS,
    get_compiler_env,
)
from app.models import (
    CompilationDiagnostic,
    CompilationResult,
    ExecuteCodeResponse,
    ExecutionStatus,
    HealthResponse,
)


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


def parse_gcc_diagnostics(
    compiler_output: str,
    source_code: Optional[str] = None,
) -> List[CompilationDiagnostic]:
    """
    Parses raw GCC compiler output into structured diagnostics.
    Matches lines like:
      filename:line:column: error: message
      filename:line:column: warning: message
      filename:line:column: fatal error: message
    """
    diagnostics: List[CompilationDiagnostic] = []
    lines_of_code = source_code.splitlines() if source_code else []

    pattern = re.compile(
        r"^(?:.*[\\/])?([^\\/:\r\n]+):(\d+):(?:(\d+):)?\s*(error|fatal error|warning|note):\s*(.+)$",
        re.MULTILINE | re.IGNORECASE,
    )

    for match in pattern.finditer(compiler_output):
        _, line_str, col_str, severity, msg = match.groups()
        line_num = int(line_str) if line_str else None
        col_num = int(col_str) if col_str else None

        context = None
        if line_num is not None and 1 <= line_num <= len(lines_of_code):
            context = lines_of_code[line_num - 1].strip()

        diagnostics.append(
            CompilationDiagnostic(
                line=line_num,
                column=col_num,
                message=msg.strip(),
                severity=severity.lower().replace("fatal ", ""),
                source_context=context,
            )
        )
    return diagnostics


def compile_c_source(
    source_file: Path,
    executable_file: Path,
    temp_dir: str,
    source_code: Optional[str] = None,
) -> CompilationResult:
    """
    Compiles a C source file into an executable binary using MSYS64 GCC.
    Returns a structured CompilationResult containing raw output and parsed diagnostics.
    """
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
            env=get_compiler_env(temp_dir),
            timeout=10.0,
        )
        stdout = compile_proc.stdout.strip()
        stderr = compile_proc.stderr.strip()
        raw_output = (compile_proc.stdout + compile_proc.stderr).strip()
        success = (compile_proc.returncode == 0) and executable_file.is_file()

        if not success and not raw_output:
            raw_output = f"Compilation failed with exit code {compile_proc.returncode}."

        diagnostics = parse_gcc_diagnostics(raw_output, source_code)

        return CompilationResult(
            success=success,
            exit_code=compile_proc.returncode,
            stdout=stdout,
            stderr=stderr,
            compiler_output=raw_output,
            errors=diagnostics,
        )
    except subprocess.TimeoutExpired:
        msg = "Compilation timed out after 10 seconds."
        return CompilationResult(
            success=False,
            exit_code=-1,
            stdout="",
            stderr=msg,
            compiler_output=msg,
            errors=[CompilationDiagnostic(message=msg, severity="error")],
        )
    except Exception as e:
        msg = f"Failed to invoke compiler: {str(e)}"
        return CompilationResult(
            success=False,
            exit_code=-1,
            stdout="",
            stderr=msg,
            compiler_output=msg,
            errors=[CompilationDiagnostic(message=msg, severity="error")],
        )


def compile_source_file(
    source_file: Path,
    executable_file: Path,
    temp_dir: str,
) -> Tuple[bool, str, int]:
    """
    Compiles a C source file into an executable using MSYS64 GCC.
    Returns: (is_success, compilation_output, returncode)
    """
    result = compile_c_source(source_file, executable_file, temp_dir)
    return result.success, result.compiler_output, result.exit_code


def execute_binary(
    executable_file: Path,
    temp_dir: str,
    stdin_data: str = "",
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Tuple[Optional[int], str, str, float, bool]:
    """
    Executes a compiled binary, piping stdin and capturing stdout/stderr with timeout enforcement.
    Returns: (exit_code, stdout, stderr, elapsed_time_ms, is_timeout)
    """
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
            env=get_compiler_env(temp_dir),
        )

        stdout_data, stderr_data = proc.communicate(
            input=stdin_data or None,
            timeout=timeout,
        )
        end_time = time.perf_counter()
        elapsed_ms = round((end_time - start_time) * 1000, 2)
        return proc.returncode, stdout_data, stderr_data, elapsed_ms, False

    except subprocess.TimeoutExpired:
        end_time = time.perf_counter()
        elapsed_ms = round((end_time - start_time) * 1000, 2)

        if proc:
            kill_process_tree(proc.pid)
            try:
                proc.kill()
                proc.communicate(timeout=1.0)
            except Exception:
                pass

        return None, "", f"Time limit exceeded ({timeout:.2f}s).", elapsed_ms, True

    except Exception as e:
        end_time = time.perf_counter()
        elapsed_ms = round((end_time - start_time) * 1000, 2)

        if proc:
            kill_process_tree(proc.pid)
            try:
                proc.kill()
            except Exception:
                pass

        return -1, "", f"Execution error: {str(e)}", elapsed_ms, False


def compile_and_run_c(
    code: str,
    stdin_input: str = "",
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> ExecuteCodeResponse:
    """
    Compiles and executes C code in an isolated temporary directory for raw execution (/api/run).
    """
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

        # 2. Compile
        comp_res = compile_c_source(
            source_file=source_file,
            executable_file=executable_file,
            temp_dir=temp_dir,
            source_code=code,
        )

        if not comp_res.success:
            return ExecuteCodeResponse(
                status=ExecutionStatus.COMPILATION_ERROR,
                compilation_output=comp_res.compiler_output,
                diagnostics=comp_res.errors,
                exit_code=comp_res.exit_code,
                execution_time_ms=0.0,
            )

        # 3. Execute
        exit_code, stdout, stderr, elapsed_ms, is_timeout = execute_binary(
            executable_file=executable_file,
            temp_dir=temp_dir,
            stdin_data=stdin_input,
            timeout=effective_timeout,
        )

        if is_timeout:
            return ExecuteCodeResponse(
                status=ExecutionStatus.TIME_LIMIT_EXCEEDED,
                stdout="",
                stderr=stderr,
                exit_code=None,
                compilation_output=comp_res.compiler_output,
                diagnostics=comp_res.errors,
                execution_time_ms=elapsed_ms,
            )

        status = ExecutionStatus.SUCCESS if exit_code == 0 else ExecutionStatus.RUNTIME_ERROR

        return ExecuteCodeResponse(
            status=status,
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            compilation_output=comp_res.compiler_output,
            diagnostics=comp_res.errors,
            execution_time_ms=elapsed_ms,
        )
