# 🚀 LeetCode-Style C Code Judge, Problem Generator & Viva Engine

A high-performance, modular **FastAPI backend** for compiling and executing C code in sandboxed environments, automated **LeetCode-style online judging**, **Local LLM-powered problem generation** with reference solution verification, and **personalized oral exam (viva voce) question generation** with dual-provider support (**Local Ollama** & **Google Gemini 3.7 Flash**).

---

## 🌟 Key Features

1. **⚡ Sandboxed C Execution Engine**:
   - Compiles and executes C11 code using **MSYS64 GCC** (`ucrt64` / `mingw64`).
   - Clean, isolated temporary directories per execution with automatic lifecycle cleanup.
   - Forceful process-tree termination on timeout (`taskkill /F /T /PID`) preventing zombie processes.
   - Built-in conflict filtering against third-party Anaconda/MinGW toolchain DLLs.

2. **🏆 LeetCode-Style Online Judge (`/api/submit`)**:
   - **Compile Once**: Compiles submitted code once into a binary and evaluates sequentially across all test cases.
   - **Hidden Test Case Protection**: Masks `input`, `expected_output`, and `actual_output` for private test cases (`is_hidden=True`) on failure.
   - **Server-Enforced Time Limits**: Strict upper bounds prevent client overrides from exceeding problem time limits.
   - **Verdict Support**: `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `RUNTIME_ERROR`, and `COMPILATION_ERROR`.

3. **🧪 Multi-Testcase Runner (`/api/test`)**:
   - Compiles code once and executes against arbitrary user-provided test cases with detailed per-testcase results and timing.

4. **🤖 Local LLM Problem Generator (`/api/generate-problem`)**:
   - Generates complete LeetCode-style C problems from natural language prompts using **Local Ollama** (optimized for 6 GB VRAM GPUs like RTX 4050).
   - **Reference C Solution Verification**: Compiles the generated reference C code and executes it against all public and hidden test cases to ensure 100% test case validity before registration.
   - **Disk Persistence**: Stores registered problems in `data/problems.json` across server reloads.

5. **🎓 Personalized Viva & Interview Question Generator (`/api/generate-viva`)**:
   - Deeply analyzes the student's exact submitted C code decisions (variables, loop bounds, conditions, modulo operators, format specifiers, memory).
   - **Verdict-Aware Questioning**: Generates questions tailored to execution outcomes (e.g. optimization for `Accepted`, bug analysis for `Wrong Answer`, complexity for `TLE`).
   - **Multi-Type Questions**: Multiple Choice (MCQ with 4 options), Descriptive Why, Tricky Edge Cases, Code Modifications ("What If"), and Debugging.
   - **Dual LLM Provider**: Run 100% offline with **Local Ollama** (`qwen2.5-coder:3b`) or switch to **Google Gemini 3.7 Flash** for high-reasoning interview synthesis.

---

## 🏗️ System Architecture & Workflow

```
                                  Client Request
                                        │
     ┌──────────────────┬───────────────┴───────────────┬──────────────────┐
     ▼                  ▼                               ▼                  ▼
POST /api/run      POST /api/test               POST /api/submit   POST /api/generate-viva
(Single Stdin)   (Custom Testcases)            (LeetCode Judge)     (Personalized Viva)
     │                  │                               │                  │
     │            [ Compile ONCE ]              [ Compile ONCE ]   [ Inspect Code & Verdict ]
     │                  │                               │                  │
     ▼                  ▼                               ▼                  ▼
[ Execute .exe ]   [ Run all testcases ]        [ Sequential Loop ]  [ Dual LLM Provider ]
Return stdout      Return per-case results      Early break on fail  (Ollama / Gemini 3.7)
                                                Hide private data          │
                                                        │                  ▼
                                                        ▼         [ Structured Viva JSON ]
                                                Return Verdict     (MCQ, Why, Tricky, Bug)
```

---

## 📋 Prerequisites

Before running the application, ensure you have:

1. **Operating System**: Windows 10/11
2. **Python**: Python 3.10 or higher
3. **C Compiler (MSYS64 GCC)**:
   - Install MSYS2 from [https://www.msys2.org/](https://www.msys2.org/)
   - Install UCRT64 toolchain: `pacman -S mingw-w64-ucrt-x86_64-gcc`
   - Verified path: `C:\msys64\ucrt64\bin\gcc.exe`
4. **Local LLM (Ollama)** *(Optional for offline Problem & Viva Generation)*:
   - Install Ollama from [https://ollama.com/](https://ollama.com/)
   - Pull recommended lightweight model: `ollama pull qwen2.5-coder:3b`
5. **Google Gemini API Key** *(Optional for Gemini 3.7 Flash cloud viva)*:
   - Obtain from [Google AI Studio](https://aistudio.google.com/)

---

## ⚙️ Installation & Setup (Step-by-Step)

### Step 1: Open Project Directory
```powershell
cd c:\Users\kampa\OneDrive\Desktop\final
```

### Step 2: Create and Activate Virtual Environment
```powershell
# Create virtual environment
python -m venv .venv

# Activate in PowerShell
.\.venv\Scripts\Activate.ps1
```

> [!TIP]
> If PowerShell script execution is restricted, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` before activating.

### Step 3: Install Required Dependencies
```powershell
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
Copy `.env.example` to create your active `.env` file:
```powershell
Copy-Item .env.example .env
```

Edit `.env` to configure your preferred models:
```env
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5-coder:3b
LLM_TIMEOUT_SECONDS=120

VIVA_LLM_PROVIDER=ollama
VIVA_OLLAMA_MODEL=qwen2.5-coder:3b
VIVA_GEMINI_MODEL=gemini-3.7-flash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 5: (Optional) Pull Local LLM Model
Ensure Ollama is running, then pull the model:
```powershell
ollama pull qwen2.5-coder:3b
```

### Step 6: Start the FastAPI Backend Server
```powershell
uvicorn app.main:app --reload --port 8000
```

The API will start at **`http://localhost:8000`** with interactive Swagger documentation at **`http://localhost:8000/docs`**.

---

## 📂 Project Structure

```
final/
├── .env                     # Active environment configuration
├── .env.example             # Configuration template
├── requirements.txt         # Pinned Python dependencies
├── data/
│   └── problems.json        # Persisted problems database
│
├── app/
│   ├── __init__.py
│   ├── config.py            # Dynamic GCC detection, clean PATH environment & settings
│   ├── models.py            # Pydantic request/response schemas & data models
│   ├── problems.py          # Problem database, test cases & JSON persistence
│   ├── main.py              # FastAPI endpoints, CORS, and routing
│   │
│   └── services/
│       ├── __init__.py
│       ├── compiler.py      # GCC compilation, isolated execution & process tree timeout kill
│       ├── judge.py         # LeetCode-style single compilation & sequential test runner
│       ├── generator.py     # Local LLM problem generator & reference C solution verifier
│       └── viva.py          # Personalized Viva Question Generator (Ollama & Gemini 3.7 Flash)
```

---

## 📖 API Reference & Examples

### 1. Judge Code Submission (`POST /api/submit`)
Compiles submitted C code once and judges it sequentially against problem test cases.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/submit" -Method Post -ContentType "application/json" -Body '{
  "problem_id": "sum-two-numbers",
  "code": "#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf(\"%d %d\", &a, &b) == 2) {\n        printf(\"%d\\n\", a + b);\n    }\n    return 0;\n}"
}' | ConvertTo-Json -Depth 5
```

**Response (Accepted):**
```json
{
  "status": "accepted",
  "problem_id": "sum-two-numbers",
  "total_test_cases": 5,
  "passed_test_cases": 5,
  "failed_test_case": null,
  "total_execution_time_ms": 74.2,
  "max_execution_time_ms": 16.5
}
```

---

### 2. Generate Personalized Viva Questions (`POST /api/generate-viva`)
Generates targeted oral exam questions analyzing the student's code and judge outcome.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/generate-viva" -Method Post -ContentType "application/json" -Body '{
  "problem_id": "sum-two-numbers",
  "submitted_code": "#include <stdio.h>\nint main() {\n    int a, b;\n    if (scanf(\"%d %d\", &a, &b) == 2) {\n        printf(\"%d\\n\", a + b);\n    }\n    return 0;\n}",
  "judge_result": { "status": "accepted", "total_test_cases": 5, "passed_test_cases": 5 },
  "number_of_questions": 4,
  "provider": "ollama"
}' | ConvertTo-Json -Depth 6
```

**Response Example:**
```json
{
  "status": "success",
  "provider_used": "ollama",
  "model_used": "qwen2.5-coder:3b",
  "total_questions": 4,
  "code_summary": "Standard procedural sum implementation with scanf return value verification.",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "difficulty": "easy",
      "category": "code_specific",
      "question": "Why does the condition check if scanf(...) == 2?",
      "options": [
        "To verify that exactly two integers were successfully read",
        "To verify that both numbers are equal to 2",
        "To allocate 2 bytes of memory",
        "It is required by C syntax"
      ],
      "correct_answer": 0,
      "explanation": "scanf returns the number of input items successfully matched and assigned.",
      "related_code": "if (scanf(\"%d %d\", &a, &b) == 2)"
    },
    {
      "id": 2,
      "type": "descriptive",
      "difficulty": "medium",
      "category": "why",
      "question": "Why is the address-of operator (&) used before 'a' and 'b' in scanf?",
      "expected_answer": "In C, arguments are passed by value. Pointers to the variables memory addresses are needed for scanf to modify them.",
      "related_code": "scanf(\"%d %d\", &a, &b)"
    },
    {
      "id": 3,
      "type": "tricky",
      "difficulty": "medium",
      "category": "edge_case",
      "question": "What happens if 'a' and 'b' are both close to 2 * 10^9?",
      "expected_answer": "Signed 32-bit integer overflow occurs because standard int max value is ~2.14 * 10^9.",
      "related_code": "a + b"
    },
    {
      "id": 4,
      "type": "code_modification",
      "difficulty": "easy",
      "category": "what_if",
      "question": "How would you modify this code to handle 64-bit integers?",
      "expected_answer": "Change variable types from int to long long and format specifiers to %lld.",
      "related_code": "int a, b;"
    }
  ],
  "generation_time_ms": 1150.2
}
```

---

### 3. Generate a Problem via Local LLM (`POST /api/generate-problem`)
Generates a complete LeetCode-style problem and verifies it with a reference C solution.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/generate-problem" -Method Post -ContentType "application/json" -Body '{
  "prompt": "Create an easy problem: Given an integer N, followed by N space-separated integers, count and print how many numbers are even.",
  "difficulty": "Easy",
  "topics": ["Array", "Math"],
  "verify_with_reference": true
}' | ConvertTo-Json -Depth 6
```

---

### 4. Custom Testcases Execution (`POST /api/test`)
Compiles C code once and runs it against custom test inputs with output comparisons.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/test" -Method Post -ContentType "application/json" -Body '{
  "code": "#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf(\"%d %d\", &a, &b) == 2) {\n        printf(\"%d\\n\", a + b);\n    }\n    return 0;\n}",
  "test_cases": [
    { "input": "10 20", "expected_output": "30" },
    { "input": "5 7", "expected_output": "12" },
    { "input": "-10 15", "expected_output": "5" }
  ],
  "timeout": 5.0
}' | ConvertTo-Json -Depth 5
```

---

### 5. Raw Code Runner (`POST /api/run`)
Compiles and executes arbitrary C code with a single standard input.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/run" -Method Post -ContentType "application/json" -Body '{
  "code": "#include <stdio.h>\n\nint main() {\n    printf(\"Hello from C Engine!\\n\");\n    return 0;\n}",
  "stdin": ""
}' | ConvertTo-Json -Depth 5
```

---

### 6. System & LLM Health Checks
- **Compiler Health**: `GET http://localhost:8000/health`
- **Local LLM Status**: `GET http://localhost:8000/api/llm/status`
- **List All Problems**: `GET http://localhost:8000/api/problems`

---

## 🔒 Security & Sandboxing Measures

- **Process-Tree Termination**: Subprocesses and any spawned child processes are forcefully terminated on timeout using Windows `taskkill /F /T /PID`.
- **Environment Isolation**: Subprocesses run in a sanitized `PATH` prioritizing MSYS64 and Windows system directories, blocking DLL collisions from other environments.
- **Resource Limits**: Strict timeouts (0.1s – 15.0s) and payload size limits (64 KB code, 256 KB stdin) prevent resource starvation.
- **Hidden Test Privacy**: Test inputs and expected outputs for hidden test cases are never returned to clients on failure.
- **Temporary Directory Auto-Cleanup**: Each compilation and run takes place inside an isolated temporary directory that is automatically destroyed upon request completion.

---

## 📄 License
MIT License. Created for competitive programming platforms and online judging systems.
