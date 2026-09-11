import os
import re
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from app.config import (
    COMPILER_FLAGS,
    DEFAULT_TIMEOUT_SECONDS,
    GCC_EXECUTABLE_PATH,
    MAX_CODE_SIZE_BYTES,
    MAX_MEMORY_LIMIT_BYTES,
    MAX_OUTPUT_SIZE_BYTES,
    MAX_STDIN_SIZE_BYTES,
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


def get_executable_extension() -> str:
    """Return .exe for Windows or empty string for Linux/POSIX."""
    return ".exe" if os.name == "nt" else ""


def kill_process_tree(pid: int) -> None:
    """
    Forcefully terminate a process and its entire process tree/group.
    On Linux / POSIX: uses os.killpg to terminate the process group, eliminating orphans.
    On Windows: uses taskkill /F /T /PID as fallback for local dev.
    """
    if pid <= 0:
        return

    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
        else:
            try:
                pgid = os.getpgid(pid)
                os.killpg(pgid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                os.kill(pid, signal.SIGKILL)
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
    """
    Return health status information about the compiler.
    Does not expose internal server filesystem paths to clients.
    """
    is_available, version_info = get_gcc_version()
    return HealthResponse(
        status="ok" if is_available else "degraded",
        gcc_path="gcc",
        gcc_available=is_available,
        gcc_version=version_info if is_available else None,
        compiler="gcc",
        available=is_available,
        version=version_info if is_available else None,
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


def _build_posix_preexec(timeout_seconds: float) -> Optional[Callable[[], None]]:
    """
    Create a preexec_fn for Linux/POSIX execution:
    - Sets process group ID via os.setsid() for process group lifecycle isolation.
    - Sets POSIX resource limits (CPU time, address space/memory, file size, core dumps).
    """
    if os.name == "nt":
        return None

    def _setup_limits():
        # Place child in a new session / process group
        try:
            os.setsid()
        except Exception:
            pass

        try:
            import resource

            # 1. CPU time limit (seconds)
            cpu_limit = max(1, int(timeout_seconds + 1))
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_limit, cpu_limit + 1))

            # 2. Virtual memory limit (RLIMIT_AS)
            if MAX_MEMORY_LIMIT_BYTES > 0:
                resource.setrlimit(resource.RLIMIT_AS, (MAX_MEMORY_LIMIT_BYTES, MAX_MEMORY_LIMIT_BYTES))

            # 3. Maximum file output size limit (e.g., prevents disk fill attacks)
            fsize_limit = max(MAX_OUTPUT_SIZE_BYTES * 2, 5 * 1024 * 1024)
            resource.setrlimit(resource.RLIMIT_FSIZE, (fsize_limit, fsize_limit))

            # 4. Disable core dumps
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        except Exception:
            pass

    return _setup_limits


def compile_c_source(
    source_file: Path,
    executable_file: Path,
    temp_dir: str,
    source_code: Optional[str] = None,
) -> CompilationResult:
    """
    Compiles a C source file into an executable binary using GCC.
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

        # Enforce execution permissions on Linux
        if executable_file.is_file() and os.name != "nt":
            try:
                executable_file.chmod(0o755)
            except Exception:
                pass

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
    Compiles a C source file into an executable using GCC.
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
    Executes a compiled binary with:
    - Resource-limited Linux subprocess isolation (process group, setrlimit memory/CPU/file-size).
    - Windows CREATE_NEW_PROCESS_GROUP fallback for local dev.
    - Guaranteed process group cleanup via kill_process_tree on timeout or failure.
    - Output size truncation to prevent memory overflow from runaway stdout.
    Returns: (exit_code, stdout, stderr, elapsed_time_ms, is_timeout)
    """
    effective_timeout = max(0.1, min(timeout, MAX_TIMEOUT_SECONDS))

    # Stdin payload protection
    if stdin_data and len(stdin_data.encode("utf-8")) > MAX_STDIN_SIZE_BYTES:
        return -1, "", f"Input exceeds maximum allowed size ({MAX_STDIN_SIZE_BYTES} bytes).", 0.0, False

    start_time = time.perf_counter()
    proc = None

    popen_kwargs = {
        "cwd": temp_dir,
        "stdin": subprocess.PIPE,
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE,
        "text": True,
        "encoding": "utf-8",
        "errors": "replace",
        "env": get_compiler_env(temp_dir),
    }

    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["preexec_fn"] = _build_posix_preexec(effective_timeout)

    try:
        proc = subprocess.Popen(
            [str(executable_file)],
            **popen_kwargs,
        )

        stdout_data, stderr_data = proc.communicate(
            input=stdin_data or None,
            timeout=effective_timeout,
        )
        end_time = time.perf_counter()
        elapsed_ms = round((end_time - start_time) * 1000, 2)

        # Truncate output if it exceeds configured limit
        if stdout_data and len(stdout_data) > MAX_OUTPUT_SIZE_BYTES:
            stdout_data = stdout_data[:MAX_OUTPUT_SIZE_BYTES] + "\n[Output truncated: exceeded maximum limit]"
        if stderr_data and len(stderr_data) > MAX_OUTPUT_SIZE_BYTES:
            stderr_data = stderr_data[:MAX_OUTPUT_SIZE_BYTES] + "\n[Stderr truncated: exceeded maximum limit]"

        return proc.returncode, stdout_data or "", stderr_data or "", elapsed_ms, False

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

        return None, "", f"Time limit exceeded ({effective_timeout:.2f}s).", elapsed_ms, True

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
    Validates code and stdin payload limits.
    """
    effective_timeout = max(0.1, min(timeout_seconds, MAX_TIMEOUT_SECONDS))

    # Validate source code payload limit
    if len(code.encode("utf-8")) > MAX_CODE_SIZE_BYTES:
        return ExecuteCodeResponse(
            status=ExecutionStatus.COMPILATION_ERROR,
            stderr=f"Source code exceeds maximum allowed size ({MAX_CODE_SIZE_BYTES} bytes).",
            compilation_output=f"Source code exceeds maximum allowed size ({MAX_CODE_SIZE_BYTES} bytes).",
            exit_code=-1,
        )

    # Validate stdin payload limit
    if stdin_input and len(stdin_input.encode("utf-8")) > MAX_STDIN_SIZE_BYTES:
        return ExecuteCodeResponse(
            status=ExecutionStatus.RUNTIME_ERROR,
            stderr=f"Input exceeds maximum allowed size ({MAX_STDIN_SIZE_BYTES} bytes).",
            exit_code=-1,
        )

    exe_suffix = get_executable_extension()
    with tempfile.TemporaryDirectory(prefix="c_runner_") as temp_dir:
        temp_path = Path(temp_dir)
        source_file = temp_path / "solution.c"
        executable_file = temp_path / f"solution{exe_suffix}"

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

        status_val = ExecutionStatus.SUCCESS if exit_code == 0 else ExecutionStatus.RUNTIME_ERROR

        return ExecuteCodeResponse(
            status=status_val,
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            compilation_output=comp_res.compiler_output,
            diagnostics=comp_res.errors,
            execution_time_ms=elapsed_ms,
        )
