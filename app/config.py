import os
import shutil
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)


def find_gcc_path() -> str:
    """
    Search for MSYS64 GCC or system GCC executable.
    Checks common MSYS64 paths first, then falls back to PATH.
    """
    candidate_paths = [
        r"C:\msys64\ucrt64\bin\gcc.exe",
        r"C:\msys64\mingw64\bin\gcc.exe",
        r"C:\msys64\usr\bin\gcc.exe",
    ]

    for path_str in candidate_paths:
        if os.path.isfile(path_str):
            return path_str

    path_gcc = shutil.which("gcc")
    if path_gcc:
        return path_gcc

    return "gcc"


# Compiler Settings
GCC_EXECUTABLE_PATH: str = find_gcc_path()

# Determine bin directory and extra MSYS2 paths to add to PATH
GCC_BIN_DIR: str = str(Path(GCC_EXECUTABLE_PATH).parent) if os.path.isabs(GCC_EXECUTABLE_PATH) else ""
MSYS_USR_BIN: str = r"C:\msys64\usr\bin" if os.path.isdir(r"C:\msys64\usr\bin") else ""


def get_compiler_env(temp_dir: str = None) -> dict:
    """
    Construct a clean execution environment that prioritizes MSYS64 and Windows system paths,
    while stripping out conflicting toolchains (e.g. Anaconda mingw-w64) that cause DLL collision.
    """
    env = os.environ.copy()

    # Core required paths in order of priority
    clean_paths = []
    if GCC_BIN_DIR:
        clean_paths.append(GCC_BIN_DIR)
    if MSYS_USR_BIN and MSYS_USR_BIN not in clean_paths:
        clean_paths.append(MSYS_USR_BIN)

    # Add Windows system directories
    system_root = env.get("SYSTEMROOT", r"C:\Windows")
    sys32 = os.path.join(system_root, "System32")
    wbem = os.path.join(sys32, "Wbem")
    powershell = os.path.join(sys32, "WindowsPowerShell", "v1.0")

    for win_dir in [sys32, system_root, wbem, powershell]:
        if os.path.isdir(win_dir) and win_dir not in clean_paths:
            clean_paths.append(win_dir)

    # Append existing paths, filtering out conflicting third-party mingw libraries
    existing_paths = env.get("PATH", "").split(os.pathsep)
    for p in existing_paths:
        p_clean = p.strip()
        if not p_clean:
            continue
        p_lower = p_clean.lower()
        # Avoid conflicting conda / embedded mingw toolchains
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

    return env


COMPILER_FLAGS: List[str] = ["-O2", "-Wall", "-std=c11", "-static-libgcc"]

# Execution Limits
DEFAULT_TIMEOUT_SECONDS: float = 5.0
MAX_TIMEOUT_SECONDS: float = 15.0
MAX_CODE_SIZE_BYTES: int = 64 * 1024  # 64 KB
MAX_STDIN_SIZE_BYTES: int = 256 * 1024  # 256 KB

# Local LLM / Ollama Configuration
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
DEFAULT_LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen2.5-coder:3b")
OLLAMA_NUM_GPU: int = int(os.getenv("OLLAMA_NUM_GPU", "99"))  # 99 offloads all model layers to GPU (VRAM)
LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
LLM_OPENAI_BASE_URL: str = os.getenv("LLM_OPENAI_BASE_URL", "").rstrip("/")

# Viva Generator Configuration (Dual Provider: Ollama & Gemini)
VIVA_LLM_PROVIDER: str = os.getenv("VIVA_LLM_PROVIDER", "ollama").lower()
VIVA_OLLAMA_MODEL: str = os.getenv("VIVA_OLLAMA_MODEL", DEFAULT_LLM_MODEL)
VIVA_GEMINI_MODEL: str = os.getenv("VIVA_GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# Data Persistence Directory
DATA_DIR: Path = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROBLEMS_FILE: Path = DATA_DIR / "problems.json"
