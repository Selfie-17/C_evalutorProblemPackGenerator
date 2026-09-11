import os
import shlex
import shutil
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)


def find_gcc_path() -> str:
    """
    Search for GCC executable:
    1. Checks CC environment variable if explicitly set.
    2. Searches system PATH via shutil.which.
    3. On Windows, falls back to common MSYS64 paths for local dev.
    4. Defaults to 'gcc'.
    """
    custom_cc = os.getenv("CC")
    if custom_cc:
        resolved = shutil.which(custom_cc)
        if resolved:
            return resolved
        if os.path.isfile(custom_cc):
            return custom_cc

    # Check system PATH
    path_gcc = shutil.which("gcc")
    if path_gcc:
        return path_gcc

    # Windows-specific fallback for local MSYS2 / MinGW development
    if os.name == "nt":
        windows_candidates = [
            r"C:\msys64\ucrt64\bin\gcc.exe",
            r"C:\msys64\mingw64\bin\gcc.exe",
            r"C:\msys64\usr\bin\gcc.exe",
        ]
        for path_str in windows_candidates:
            if os.path.isfile(path_str):
                return path_str

    return "gcc"


# Compiler Settings
GCC_EXECUTABLE_PATH: str = find_gcc_path()
CC_NAME: str = os.getenv("CC", "gcc")

# Parse CFLAGS from environment (default: C11, O2 optimization, pipe)
_default_cflags = "-std=c11 -O2 -pipe"
_raw_cflags = os.getenv("CFLAGS", _default_cflags).strip()
try:
    COMPILER_FLAGS: List[str] = shlex.split(_raw_cflags) if _raw_cflags else shlex.split(_default_cflags)
except Exception:
    COMPILER_FLAGS: List[str] = ["-std=c11", "-O2", "-pipe"]

# Extra Windows MSYS2 bin directory if running on Windows
GCC_BIN_DIR: str = str(Path(GCC_EXECUTABLE_PATH).parent) if (os.name == "nt" and os.path.isabs(GCC_EXECUTABLE_PATH)) else ""
MSYS_USR_BIN: str = r"C:\msys64\usr\bin" if (os.name == "nt" and os.path.isdir(r"C:\msys64\usr\bin")) else ""


def get_compiler_env(temp_dir: Optional[str] = None) -> dict:
    """
    Construct a clean execution environment for compiler and binary subprocesses.
    On Windows: ensures MSYS64 and Windows System32 paths are present while filtering conflicts.
    On Linux / POSIX: inherits standard system environment with clean temporary directory settings.
    """
    env = os.environ.copy()

    if os.name == "nt":
        clean_paths = []
        if GCC_BIN_DIR:
            clean_paths.append(GCC_BIN_DIR)
        if MSYS_USR_BIN and MSYS_USR_BIN not in clean_paths:
            clean_paths.append(MSYS_USR_BIN)

        system_root = env.get("SYSTEMROOT", r"C:\Windows")
        sys32 = os.path.join(system_root, "System32")
        wbem = os.path.join(sys32, "Wbem")
        powershell = os.path.join(sys32, "WindowsPowerShell", "v1.0")

        for win_dir in [sys32, system_root, wbem, powershell]:
            if os.path.isdir(win_dir) and win_dir not in clean_paths:
                clean_paths.append(win_dir)

        existing_paths = env.get("PATH", "").split(os.pathsep)
        for p in existing_paths:
            p_clean = p.strip()
            if not p_clean:
                continue
            p_lower = p_clean.lower()
            if "anaconda" in p_lower and "mingw" in p_lower:
                continue
            if p_clean not in clean_paths:
                clean_paths.append(p_clean)

        env["PATH"] = os.pathsep.join(clean_paths)
        env["SYSTEMROOT"] = system_root
        env["WINDIR"] = system_root

    if temp_dir:
        env["TMP"] = temp_dir
        env["TEMP"] = temp_dir
        env["TMPDIR"] = temp_dir

    return env


# Execution Limits (environment configurable)
DEFAULT_TIMEOUT_SECONDS: float = float(os.getenv("DEFAULT_EXECUTION_TIMEOUT", "5.0"))
MAX_TIMEOUT_SECONDS: float = float(os.getenv("MAX_EXECUTION_TIMEOUT", "15.0"))
MAX_CODE_SIZE_BYTES: int = int(os.getenv("MAX_CODE_SIZE", str(64 * 1024)))       # 64 KB
MAX_STDIN_SIZE_BYTES: int = int(os.getenv("MAX_STDIN_SIZE", str(256 * 1024)))    # 256 KB
MAX_OUTPUT_SIZE_BYTES: int = int(os.getenv("MAX_OUTPUT_SIZE", str(1024 * 1024))) # 1 MB
MAX_MEMORY_LIMIT_BYTES: int = int(os.getenv("MAX_MEMORY_LIMIT_BYTES", str(256 * 1024 * 1024))) # 256 MB

# Batch Evaluation Workers
MAX_EVALUATION_WORKERS: int = int(os.getenv("MAX_EVALUATION_WORKERS", "3"))

# Database Configuration (SQLite local default, Aiven PostgreSQL in production)
DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()

# Frontend & CORS Configuration
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "").strip()

# Cloud AI & LLM Provider Configuration
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini" if GEMINI_API_KEY else "ollama").lower()
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
DEFAULT_LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen2.5-coder:3b")
OLLAMA_NUM_GPU: int = int(os.getenv("OLLAMA_NUM_GPU", "99"))
LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
LLM_OPENAI_BASE_URL: str = os.getenv("LLM_OPENAI_BASE_URL", "").rstrip("/")

# Viva Generator Configuration
VIVA_LLM_PROVIDER: str = os.getenv("VIVA_LLM_PROVIDER", LLM_PROVIDER).lower()
VIVA_OLLAMA_MODEL: str = os.getenv("VIVA_OLLAMA_MODEL", DEFAULT_LLM_MODEL)
VIVA_GEMINI_MODEL: str = os.getenv("VIVA_GEMINI_MODEL", GEMINI_MODEL).strip()

# Data Persistence Directory
DATA_DIR: Path = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROBLEMS_FILE: Path = DATA_DIR / "problems.json"
