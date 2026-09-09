# 🚀 C Lab Evaluator & LeetCode-Style Online Judge Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.0+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![GCC](https://img.shields.io/badge/MSYS64%20GCC-UCRT64%20%2F%20C11-00599C?style=flat&logo=gnu&logoColor=white)](https://www.msys2.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?style=flat&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Tests](https://img.shields.io/badge/Tests-35%2F35%20Passing-success?style=flat&logo=pytest&logoColor=white)](tests/)

An enterprise-grade, full-stack laboratory grading, online judging, and automated problem engineering platform for C programming education. Built with a high-performance **FastAPI** backend, sandboxed **MSYS64 GCC C11** execution, **SQLite** persistence, an **Intelligent Problem Pack Engine** with deterministic Python validation and dual LLMs (**Local Ollama** & **Google Gemini Flash**), and a modern **React 19 + TypeScript + Vite** web interface.

---

## 📑 Table of Contents

- [🌟 Key System Capabilities](#-key-system-capabilities)
- [🏗️ System Architecture & Workflow](#️-system-architecture--workflow)
- [📂 Project Structure](#-project-structure)
- [📋 Prerequisites & Toolchains](#-prerequisites--toolchains)
- [⚙️ Installation & Setup (Step-by-Step)](#️-installation--setup-step-by-step)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Running the Platform](#4-running-the-platform)
- [🧠 Problem Engine & Canonical Schema (v1.0)](#-problem-engine--canonical-schema-v10)
- [🎓 Batch Laboratory Evaluation & Section Management](#-batch-laboratory-evaluation--section-management)
- [📖 Complete REST API Reference](#-complete-rest-api-reference)
  - [1. Core Execution & Judge Endpoints](#1-core-execution--judge-endpoints)
  - [2. Laboratory Weeks & Problem Packs](#2-laboratory-weeks--problem-packs)
  - [3. Submissions & Batch Evaluation](#3-submissions--batch-evaluation)
  - [4. Students & Submission Diagnostics](#4-students--submission-diagnostics)
  - [5. Analytics & Multi-Format Data Exports](#5-analytics--multi-format-data-exports)
  - [6. Problem Engine Endpoints](#6-problem-engine-endpoints)
  - [7. Personalized Viva Voce Generation](#7-personalized-viva-voce-generation)
- [🔒 Sandboxing, Security & Fault Tolerance](#-sandboxing-security--fault-tolerance)
- [🧪 Running the Test Suite](#-running-the-test-suite)
- [📄 License](#-license)

---

## 🌟 Key System Capabilities

### 1. ⚡ Sandboxed C11 Compilation & Execution Engine
- **Toolchain Discovery**: Dynamically resolves **MSYS64 GCC** (`ucrt64` / `mingw64`) with path sanitization and environment isolation.
- **DLL Conflict Filtration**: Automatically strips third-party Anaconda and embedded MinGW libraries from the sub-process `PATH` to avoid runtime DLL clashes.
- **Isolated Lifecycles**: Every compilation and run executes in a dedicated temporary directory (`c_exec_*` / `c_verify_*`) with guaranteed cleanup.
- **Process Tree Kill**: Forceful timeout termination on Windows using `taskkill /F /T /PID` to eliminate zombie processes and infinite loop starvation.
- **Compiler Diagnostics**: Detailed line-and-column diagnostic parsing with severity categorization (`error`, `warning`, `note`).

### 2. 🏆 LeetCode-Style Online Judge
- **Single Compilation Strategy**: Compiles submitted source code once into an executable binary and tests it sequentially across all problem test cases.
- **Verdict System**: Full support for standard verdicts: `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `RUNTIME_ERROR`, and `COMPILATION_ERROR`.
- **Hidden Test Protection**: Masks inputs, expected outputs, and actual outputs for private/hidden test cases (`is_hidden=True`) on evaluation failure.
- **Strict Limits**: Server-side bounds enforce execution timeouts (0.1s – 15.0s) and payload size limits (64 KB code, 256 KB stdin).

### 3. 📦 Laboratory Week & Problem Pack Management
- **Academic Week Hierarchy**: Organize lab sessions by weeks (e.g. `week-01`, `week-02`, etc.) with titles, descriptions, and lifecycle states (`draft`, `configured`, `evaluating`, `completed`).
- **Standardized Packs (P1..P10+)**: Maintain 10-problem curriculum packs per week with public samples, hidden evaluation cases, and verified C reference solutions.
- **Instant Seeding**: One-click seeding of pre-verified standard LeetCode C problems.
- **Instructor Question Conversion**: Convert raw problem lists directly into fully specified problem packs (`/generate-from-questions`) with automated test cases and reference C solutions.
- **Problem Pack Archive Export**: Download complete week problem packs as structured ZIP files containing `P1.json`..`P10.json` and `problem_pack.json`.

### 4. 🗂️ Batch Student Submissions ZIP Evaluator
- **Safe Extraction**: Built-in protection against **Zip Slip** directory traversal attacks.
- **Automatic Folder & Student ID Discovery**: Recursively extracts and normalizes university student IDs (e.g., `N240046`, `N180001`, `n210543`, `23001`), supporting nested section subdirectories.
- **Flexible Filename Mapping**: Automatically detects student C files matching patterns like `p1.c`..`p10.c`, `P01.c`, `problem1.c`, and `prob_01.c`.
- **Class Section Tagging**: Assign submissions to distinct class sections (**Section A** through **Section F**).
- **Pre-Evaluation Integrity Report**: Preview student roster, discovered problem counts, and missing file breakdowns prior to running evaluations.
- **Concurrent Asynchronous Evaluation**: Thread-pool worker execution with configurable concurrency (`MAX_EVALUATION_WORKERS=3`), non-blocking background jobs, and real-time progress tracking.

### 5. 🧠 Intelligent Problem Engine (Dual LLM + Python Verification)
- **Canonical Schema v1.0**: Round-trip JSON import and export adhering to strict Pydantic schemas (`ProblemPack`, `Problem`, `TestCase`, `Classification`, `TestStrategy`).
- **Natural Language Parsing**: Ingests raw multiline syllabus text and structures it into individual problem entities.
- **Deterministic Python Verification**: Mathematically verifies test case inputs and expected outputs for arithmetic, number properties, loops, grade evaluation, date/leap-year rules, and switch calculators before saving.
- **Algorithmic 50+ Test Case Synthesizers**: Generates comprehensive suites covering `base`, `boundary`, `edge`, `failing`, `special`, `stress`, and `metamorphic` categories.
- **Dual AI Provider Integration**:
  - **Local Ollama**: Run completely offline with GPU acceleration (`qwen2.5-coder:3b`, customizable layer offloading via `OLLAMA_NUM_GPU=99`).
  - **Google Gemini Flash**: High-speed cloud generation and test case review (`gemini-2.5-flash` / `gemini-3.7-flash`).
- **Reference Solution Verification & Auto-Calibration**: Compiles reference C implementations to verify test suite validity or automatically calibrate expected outputs to match verified C reference behavior.

### 6. 🎓 Personalized Viva Voce Question Generator
- **Code Decision Inspection**: Analyzes the student's exact submitted C code (loop boundaries, data types, format specifiers, pointer dereferences, and conditional branches).
- **Verdict-Aware Questioning**: Dynamically alters question focus depending on judge outcome:
  - *Accepted*: Optimization, memory layout, Big-O complexity, and alternative constructs.
  - *Wrong Answer / Runtime Error*: Bug analysis, edge condition tracing, and boundary failure analysis.
  - *TLE*: Algorithmic complexity and infinite loop scenarios.
- **Diverse Question Archetypes**:
  - **MCQ**: 4-option multiple choice with correct answer and detailed explanation.
  - **Descriptive Why**: Deep conceptual justification questions.
  - **Tricky Edge Cases**: Boundary behavior and overflow vulnerabilities.
  - **Code Modification ("What If")**: Architectural and type-widening modifications.
  - **Debugging**: Locating and fixing syntax or logical errors.

### 7. 📊 Real-Time Analytics & Multi-Format Data Exports
- **Performance Analytics**: Class pass rates, problem-by-problem acceptance rates, average execution times, and verdict distributions.
- **Section Filtering**: Instantly filter analytics and student rosters by specific section or aggregate across all sections.
- **Deep-Dive Student Modal**: Inspect individual student submissions with syntax-highlighted source code, compiler error diagnostics, and per-testcase execution metrics.
- **Export Formats**:
  - Individual Student JSON: `student_<ID>_week_<N>.json`
  - Consolidated Week JSON: `week_<N>_<section>_results.json`
  - Complete Results ZIP Archive: `week_<N>_<section>_results.zip` containing `week_summary.json`, `students/*.json`, and `problems/*.json`.

### 8. 💻 Modern React 19 Frontend Web Application
- Built with React 19, TypeScript, and Vite.
- Responsive dark/light themed interface with Lucide icons.
- Interactive LeetCode-style C coding IDE with custom stdin runner, batch test execution, and difference inspection.
- Live GCC compiler health indicator and Ollama connectivity status in the sidebar.

---

## 🏗️ System Architecture & Workflow

```
                                  Client Browser / API Client
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
             [ React 19 + Vite ]                            [ FastAPI Backend ]
           (Port 5173 / Production)                            (Port 8000)
                       │                                               │
       ┌───────────────┴───────────────┐               ┌───────────────┴───────────────┐
       ▼               ▼               ▼               ▼               ▼               ▼
  Dashboard       Laboratory      Problem Hub    Batch Evaluator  Online Judge   Problem Engine
  Analytics       Weeks Hub      & LeetCode IDE   (Async Worker)   (Single .exe)  (Dual LLM + Py)
                                                       │               │               │
                                                       ▼               ▼               ▼
                                                 ┌──────────┐    ┌──────────┐    ┌──────────┐
                                                 │ SQLite3  │    │ MSYS64   │    │ Ollama / │
                                                 │ c_eval.db│    │ GCC C11  │    │ Gemini   │
                                                 │   (WAL)  │    │ Sandbox  │    │ API      │
                                                 └──────────┘    └──────────┘    └──────────┘
```

### Batch Evaluation Lifecycle
```
1. Instructor uploads submissions ZIP -> 2. Zip Slip Check & Student/P1..P10 Discovery
3. Section Tagging & Validation Report -> 4. Asynchronous Thread Pool Job Launch
5. Sequential C11 Compilation & Run    -> 6. SQLite Persistence & Live Progress Polling
7. Aggregated Analytics & Charts       -> 8. Multi-format JSON / ZIP Results Export
```

---

## 📂 Project Structure

```
CodeFilesTest/
├── .env                              # Active environment configuration
├── .env.example                      # Configuration template
├── requirements.txt                  # Python dependencies (FastAPI, Uvicorn, Pydantic, etc.)
├── README.md                         # Project documentation
│
├── app/
│   ├── __init__.py
│   ├── config.py                     # GCC discovery, sanitized PATH & LLM settings
│   ├── main.py                       # FastAPI application entry point, CORS & route registration
│   ├── models.py                     # Pydantic request/response schemas & data models
│   ├── problems.py                   # In-memory problem store & persistence helpers
│   │
│   ├── api/                          # Modular API Routers
│   │   ├── __init__.py
│   │   ├── analytics.py              # Class analytics, performance metrics & export endpoints
│   │   ├── evaluations.py            # ZIP validation & batch evaluation background jobs
│   │   ├── problem_engine.py         # Schema v1.0, AI test synthesis, calibration & LeetCode runner
│   │   ├── students.py               # Student rosters, individual summaries & submission code
│   │   └── weeks.py                  # Lab weeks CRUD, pack seeding & instructor question generator
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   └── db.py                     # SQLite connection manager, WAL mode, migrations & queries
│   │
│   └── services/
│       ├── __init__.py
│       ├── analytics.py              # Student metrics & week-level aggregation calculations
│       ├── compiler.py               # MSYS64 GCC compilation, sandboxed execution & taskkill timeout
│       ├── evaluation.py             # Background multi-threaded batch evaluator
│       ├── export.py                 # Structured JSON & ZIP archive generation
│       ├── generator.py              # Ollama problem generation & reference C verification
│       ├── judge.py                  # LeetCode-style single compilation & sequential test evaluation
│       ├── pack_generator.py         # 10-problem pack generation & default problem seeding
│       ├── viva.py                   # Personalized viva voce generation (Ollama & Gemini Flash)
│       └── zip_processor.py          # Zip Slip protection, student ID parsing & file discovery
│
├── problem_engine/                   # Autonomous Problem Engine Core
│   ├── __init__.py
│   ├── gemini_reviewer.py            # Google Gemini AI test review & quality scoring
│   ├── json_io.py                    # Canonical JSON import/export & sample pack builders
│   ├── problem_classifier.py         # Construct detection & difficulty classification
│   ├── problem_pack_manager.py       # High-level coordinator for parsing, tests & deployment
│   ├── problem_parser.py             # Natural text & syllabus parser
│   ├── problem_schema.py             # Canonical Pydantic Schema v1.0 (ProblemPack, TestCase)
│   ├── test_case_generator.py        # 50+ test synthesizers & dual-model dispatcher
│   └── test_case_validator.py        # Deterministic Python test validation rules
│
├── frontend/                         # React 19 + TypeScript + Vite Single Page Application
│   ├── index.html                    # Web entry point
│   ├── package.json                  # Dependencies (React 19, Lucide React, Vite, Oxlint)
│   ├── vite.config.ts                # Vite build and proxy configuration
│   ├── tsconfig.json                 # TypeScript project configuration
│   └── src/
│       ├── App.tsx                   # Main layout, sidebar navigation & compiler health monitor
│       ├── App.css                   # Layout and utility styling
│       ├── index.css                 # Comprehensive CSS design tokens & theme styling
│       ├── main.tsx                  # React DOM bootstrap
│       ├── types/                    # Shared TypeScript interfaces & API contracts
│       ├── services/                 # Backend API client (`api.ts`)
│       ├── components/               # Modular UI Components
│       │   ├── Charts.tsx            # SVG Donut verdict charts & pass rate bar graphs
│       │   ├── CodeViewer.tsx        # Syntax-highlighted C code viewer
│       │   ├── CompilationErrorViewer.tsx # GCC compiler diagnostic error viewer
│       │   ├── GeneratePackModal.tsx # AI Problem pack generation modal
│       │   ├── LeetCodeProblemView.tsx # Interactive LeetCode-style code editor & runner
│       │   ├── NewWeekModal.tsx      # Modal to configure new laboratory weeks
│       │   ├── ProblemDetailModal.tsx# Problem specification & test cases viewer
│       │   ├── ProblemDivisionModal.tsx # AI problem division review modal
│       │   ├── StatCard.tsx          # Metric cards for dashboards
│       │   ├── StudentDetailModal.tsx# Student performance & submission breakdown modal
│       │   ├── SubmissionDetailModal.tsx # Detailed test-by-test submission outcomes
│       │   ├── TestCaseTable.tsx     # Categorized test case table with badge pills
│       │   └── VerdictBadge.tsx      # Color-coded verdict badges
│       └── views/                    # Top-Level Page Views
│           ├── DashboardView.tsx     # Overview dashboard with quick stats & actions
│           ├── WeeksView.tsx         # Laboratory weeks catalog & management
│           ├── WeekDetailView.tsx    # Multi-tab week management hub (Problems, Upload, Analytics)
│           ├── ProblemEngineView.tsx # Interactive Problem Engine builder & test synthesizer
│           └── ProblemPackView.tsx   # Problem pack authoring and review workspace
│
├── data/                             # Data Storage & Persistence
│   ├── c_eval.db                     # SQLite database (auto-created on startup)
│   ├── problems.json                 # Persisted JSON problem store
│   └── staging/                      # Temporary extraction directory for student ZIP uploads
│
├── tests/                            # Comprehensive Test Suite (35 Tests)
│   ├── test_api_endpoints.py         # Problem engine API integration tests
│   ├── test_problem_json.py          # Canonical Schema v1.0 round-trip import/export tests
│   ├── test_problem_parser.py        # Text & syllabus parsing unit tests
│   ├── test_problem_schema.py        # Pydantic schema validation tests
│   ├── test_test_case_generation.py  # 50+ test case synthesis and dispatch tests
│   ├── test_test_case_validator.py   # Deterministic Python validator test suite
│   └── test_zip_student_id.py        # Student ID regex parsing & Zip Slip protection tests
│
└── Zip files/                        # Reference / Sample student submission batches
    ├── N240046/
    ├── N240081/
    ├── N240149/
    └── N240157/
```

---

## 📋 Prerequisites & Toolchains

Before setting up the project, ensure the following software is installed on your Windows machine:

1. **Operating System**: Windows 10 or 11 (64-bit).
2. **Python**: Python 3.10, 3.11, or 3.12 (ensure Python is added to your system `PATH`).
3. **Node.js**: Node.js v18.0+ and npm (for the React frontend).
4. **C Compiler (MSYS64 GCC)**:
   - Install MSYS2 from [https://www.msys2.org/](https://www.msys2.org/).
   - Open the **MSYS2 UCRT64** shell and install the GCC toolchain:
     ```bash
     pacman -S mingw-w64-ucrt-x86_64-gcc
     ```
   - Default verified path: `C:\msys64\ucrt64\bin\gcc.exe` (or `C:\msys64\mingw64\bin\gcc.exe`).
5. **Local LLM (Ollama)** *(Optional for 100% offline Problem & Viva Generation)*:
   - Download and install Ollama from [https://ollama.com/](https://ollama.com/).
   - Pull the recommended lightweight coding model:
     ```powershell
     ollama pull qwen2.5-coder:3b
     ```
6. **Google Gemini API Key** *(Optional for cloud test generation & review)*:
   - Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).

---

## ⚙️ Installation & Setup (Step-by-Step)

### 1. Backend Setup

Open a PowerShell terminal in the project root directory:

```powershell
# Navigate to the workspace directory
cd c:\Users\kampa\OneDrive\Desktop\CodeFilesTest

# Create a Python virtual environment
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install all required dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

> [!TIP]
> If you encounter PowerShell script execution policy restrictions, run:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` prior to activating the virtual environment.

### 2. Environment Configuration

Copy `.env.example` to create your active `.env` configuration file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` to configure your preferred settings:

```env
# ==========================================
# C Compiler & Judge Backend Configuration
# ==========================================

# Local LLM / Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5-coder:3b
LLM_TIMEOUT_SECONDS=120
OLLAMA_NUM_GPU=99

# Personalized Viva Question Generator Settings
VIVA_LLM_PROVIDER=ollama
VIVA_OLLAMA_MODEL=qwen2.5-coder:3b
VIVA_GEMINI_MODEL=gemini-2.5-flash

# Google Gemini API Key (Optional: for cloud generation and review)
GEMINI_API_KEY=your_gemini_api_key_here

# Batch Evaluation Worker Concurrency
MAX_EVALUATION_WORKERS=3
```

### 3. Frontend Setup

In a new terminal window, navigate to the `frontend` folder and install Node packages:

```powershell
cd frontend
npm install
```

### 4. Running the Platform

#### Start the FastAPI Backend Server:
```powershell
# From project root with virtual environment activated:
uvicorn app.main:app --reload --port 8000
```
- **Backend API URL**: `http://localhost:8000`
- **Interactive OpenAPI Documentation (Swagger)**: `http://localhost:8000/docs`
- **Alternative ReDoc Documentation**: `http://localhost:8000/redoc`

#### Start the React Frontend Development Server:
```powershell
# From the frontend directory:
cd frontend
npm run dev
```
- **Frontend Web UI**: `http://localhost:5173` (or port specified in terminal output).

---

## 🧠 Problem Engine & Canonical Schema (v1.0)

The **Problem Engine** standardizes problem authoring, categorization, test generation, and automated validation using **Canonical Schema Version 1.0**.

### Canonical JSON Specification
```json
{
  "schema_version": "1.0",
  "problem_pack_id": "week-01",
  "title": "C Laboratory Problem Pack: Basics & Conditionals",
  "language": "C",
  "total_problems": 10,
  "generation_status": "approved",
  "problems": [
    {
      "problem_id": "P1",
      "title": "Check Even or Odd",
      "statement": "Write a C program to check whether a given integer n is even or odd.",
      "requirements": ["Read a single integer", "Print 'Even' or 'Odd' followed by newline"],
      "concepts": ["modulo", "conditionals"],
      "constraints": ["-10^9 <= n <= 10^9"],
      "classification": {
        "category": "conditional",
        "difficulty": "easy",
        "required_constructs": ["if-else", "%"]
      },
      "test_strategy": {
        "base_cases": 10,
        "boundary_cases": 5,
        "edge_cases": 5,
        "special_cases": 2,
        "stress_cases": 5
      },
      "test_cases": [
        {
          "test_id": "P1-T01",
          "category": "base",
          "input": "4\n",
          "expected_output": "Even\n",
          "reason": "Standard positive even integer",
          "severity": "normal",
          "validation_status": "passed",
          "validation_notes": "Verified by Python validator"
        }
      ],
      "reference_solution_c": "#include <stdio.h>\nint main() { long long n; if (scanf(\"%lld\", &n) == 1) { if (n % 2 == 0) printf(\"Even\\n\"); else printf(\"Odd\\n\"); } return 0; }",
      "division_approved": true
    }
  ]
}
```

### Test Case Categories
| Category | Purpose | Example Scenarios |
| :--- | :--- | :--- |
| `base` | Standard expected inputs | Typical positive numbers, regular text strings |
| `boundary` | Transition thresholds | 0, 1, -1, maximum 32-bit integer (`2147483647`) |
| `edge` | Extremes & corner cases | Negative numbers, leap century years, single character |
| `failing` | Error condition triggers | Division by zero, invalid menu choices |
| `special` | Domain-specific logic | Non-alphanumeric symbols, whitespace inputs |
| `stress` | Performance / scale limits | Inputs approaching $10^9$ or $10^{18}$ |
| `metamorphic` | Relation-preserving checks | Inverted operand orders, symmetry checks |

---

## 🎓 Batch Laboratory Evaluation & Section Management

The platform is designed to effortlessly process hundreds of student lab submissions simultaneously.

### Submission Archive Structure
Instructors can upload a `.zip` archive structured with student IDs and C source files:

```
Submissions_Week02.zip
├── N240046/
│   ├── p1.c
│   ├── p2.c
│   └── p3.c
├── N240081/
│   ├── p1.c
│   └── p2.c
└── N240149/
    ├── p1.c
    ├── p2.c
    └── p3.c
```

### Class Section Tagging & Isolation
- Submissions can be uploaded directly under a chosen section (**Section A**, **Section B**, **Section C**, **Section D**, **Section E**, **Section F**).
- All evaluations, pass rates, student rosters, and JSON/ZIP exports can be filtered by section or viewed comprehensively.

### Safe ZIP Validation & Slip Protection
Before executing student code, the backend:
1. Validates file path canonicalization to prevent Zip Slip file overwrite attacks.
2. Identifies all student ID directories and parses problem numbers (`p1.c`..`p10.c`).
3. Produces a pre-run report displaying detected students, completed problems, and missing submissions.
4. Stores files in a temporary staging cache keyed with a secure UUID token.

---

## 📖 Complete REST API Reference

### 1. Core Execution & Judge Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Verify MSYS64 GCC compiler status, path, and version |
| `POST` | `/api/run` | Compile and run raw C code with single standard input |
| `POST` | `/api/test` | Compile C code once and execute across user-supplied custom test cases |
| `POST` | `/api/submit` | LeetCode-style judging against stored problem test cases |
| `GET` | `/api/problems` | List all available coding problems |
| `GET` | `/api/problems/{problem_id}` | Retrieve problem details and public sample test cases |
| `GET` | `/api/llm/status` | Check local Ollama server connectivity and available models |

#### Judge Submission Example (`POST /api/submit`)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/submit" -Method Post -ContentType "application/json" -Body '{
  "problem_id": "sum-two-numbers",
  "code": "#include <stdio.h>\nint main() {\n    int a, b;\n    if (scanf(\"%d %d\", &a, &b) == 2) printf(\"%d\\n\", a + b);\n    return 0;\n}"
}' | ConvertTo-Json -Depth 5
```

---

### 2. Laboratory Weeks & Problem Packs

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/weeks` | List all configured lab weeks with problem & student counts |
| `POST` | `/api/weeks` | Create a new lab week (`week_number`, `title`, `description`) |
| `GET` | `/api/weeks/{week_id}` | Retrieve details and status for a specific week |
| `PUT` | `/api/weeks/{week_id}` | Update title, description, or status for a week |
| `DELETE` | `/api/weeks/{week_id}` | Delete a week and cascade delete its problems & submissions |
| `GET` | `/api/weeks/{week_id}/problems` | Retrieve all problems configured for a week (P1..P10) |
| `POST` | `/api/weeks/{week_id}/seed-default-pack` | Instantly seed standard pre-verified LeetCode C problems |
| `POST` | `/api/weeks/{week_id}/generate-pack` | Generate a 10-problem pack via AI with reference verification |
| `POST` | `/api/weeks/{week_id}/generate-from-questions` | Generate a full problem pack from exact teacher questions |
| `DELETE` | `/api/weeks/{week_id}/problems` | Delete all problems in a week pack |
| `DELETE` | `/api/weeks/{week_id}/problems/{num_or_id}` | Delete a single problem from a week |
| `GET` | `/api/weeks/{week_id}/export-pack` | Download `Week_XX_Problems.zip` archive |

---

### 3. Submissions & Batch Evaluation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/weeks/{week_id}/submissions/validate-zip` | Upload, sanitize, and validate student submissions ZIP |
| `POST` | `/api/evaluations/start` | Launch asynchronous batch evaluation job with section tagging |
| `GET` | `/api/evaluations/{job_id}/progress` | Poll real-time progress for an ongoing evaluation job |

#### Batch Evaluation Polling Response Example
```json
{
  "id": "7a881e3f-4e67-4229-873b-b27e69f88120",
  "week_id": "week-02",
  "section": "Section A",
  "status": "running",
  "total_students": 64,
  "processed_students": 28,
  "total_submissions": 640,
  "processed_submissions": 280,
  "current_student": "Evaluating student N240081 (P4)...",
  "started_at": "2026-09-09T05:30:00.000Z",
  "completed_at": null,
  "error_message": null
}
```

---

### 4. Students & Submission Diagnostics

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/weeks/{week_id}/students` | List student summaries (optionally filtered by `?section=Section+A`) |
| `GET` | `/api/weeks/{week_id}/students/{student_id}` | Retrieve comprehensive performance overview for a student |
| `GET` | `/api/weeks/{week_id}/students/{student_id}/submissions/{p_num}` | Retrieve submission source code, line diagnostics, and test results |

---

### 5. Analytics & Multi-Format Data Exports

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/weeks/{week_id}/analytics` | Comprehensive pass rates, time averages, and verdict distributions |
| `GET` | `/api/weeks/{week_id}/students/{student_id}/export` | Download single student results JSON |
| `GET` | `/api/weeks/{week_id}/export/json` | Download consolidated week results JSON (with section filter) |
| `GET` | `/api/weeks/{week_id}/export/zip` | Download complete results ZIP with summary and student files |

---

### 6. Problem Engine Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/problem-engine/gemini-status` | Check if Google Gemini API key is configured |
| `GET` | `/api/problem-engine/sample-json` | Retrieve canonical sample ProblemPack JSON (v1.0) |
| `GET` | `/api/problem-engine/sample-problem-json`| Retrieve canonical sample single Problem JSON (v1.0) |
| `POST` | `/api/problem-engine/parse` | Parse raw multiline problem statements into structured problems |
| `POST` | `/api/problem-engine/classify` | Classify problem difficulty and required C constructs |
| `POST` | `/api/problem-engine/validate-json` | Strictly validate JSON against Canonical Schema v1.0 |
| `POST` | `/api/problem-engine/generate-problem` | Generate 50+ test cases for a single problem |
| `POST` | `/api/problem-engine/generate-pack` | Generate test cases sequentially for an entire problem pack |
| `POST` | `/api/problem-engine/validate-test-cases` | Run deterministic Python validation over test cases |
| `POST` | `/api/problem-engine/gemini-review` | Request a quality review report from Gemini Flash |
| `POST` | `/api/problem-engine/deploy-to-week/{id}`| Commit ProblemPack problems to SQLite for lab evaluation |
| `POST` | `/api/problem-engine/run-code` | Execute C code in LeetCode environment (single stdin or batch) |
| `POST` | `/api/problem-engine/verify-problem-testcases` | Verify test cases against reference C solution |
| `POST` | `/api/problem-engine/calibrate-problem-testcases` | Auto-calibrate expected outputs with reference C solution |

---

### 7. Personalized Viva Voce Generation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/generate-viva` | Generate targeted viva voce exam questions based on student C code & verdict |

#### Sample Viva Generation Request (`POST /api/generate-viva`)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/generate-viva" -Method Post -ContentType "application/json" -Body '{
  "problem_id": "sum-two-numbers",
  "submitted_code": "#include <stdio.h>\nint main() {\n    int a, b;\n    if (scanf(\"%d %d\", &a, &b) == 2) {\n        printf(\"%d\\n\", a + b);\n    }\n    return 0;\n}",
  "judge_result": { "status": "accepted", "total_test_cases": 5, "passed_test_cases": 5 },
  "number_of_questions": 4,
  "provider": "ollama"
}' | ConvertTo-Json -Depth 6
```

---

## 🔒 Sandboxing, Security & Fault Tolerance

1. **Process Tree Termination**:
   - Subprocesses are forcefully terminated on timeout using Windows `taskkill /F /T /PID`.
   - Prevents orphaned compiler processes or running student binaries from consuming CPU cycles indefinitely.

2. **Sanitized Environment (`PATH`)**:
   - Strips Anaconda, Conda, and third-party MinGW paths from the execution environment.
   - Strictly prioritizes `C:\msys64\ucrt64\bin` and Windows `System32`, eliminating DLL version collision crashes (`libwinpthread-1.dll`, etc.).

3. **Zip Slip Traversal Prevention**:
   - Archive extraction explicitly checks `os.path.commonpath` to verify all extracted target paths remain inside the dedicated staging directory.
   - Malicious path components (such as `../../Windows/System32`) are immediately rejected with a `ValueError`.

4. **Hidden Test Privacy**:
   - Inputs, expected outputs, and student stdout for hidden test cases (`is_hidden=True`) are masked upon failure to prevent test case leaking during online judging.

5. **Resource Bounds**:
   - Timeouts are strictly clamped between 0.1s and 15.0s.
   - Payloads are restricted to 64 KB for source code and 256 KB for standard input.

6. **Transactional Database Integrity**:
   - SQLite operates with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging) and `PRAGMA foreign_keys = ON;`.
   - Multi-statement operations run in transactional contexts with automatic rollback upon exceptions.

---

## 🧪 Running the Test Suite

The platform includes a comprehensive automated test suite covering API endpoints, canonical JSON schemas, problem text parsers, 50+ test case synthesizers, deterministic Python validators, and Student ID regex extraction.

### Run All Backend Unit & Integration Tests:
```powershell
# From project root:
.\.venv\Scripts\python -m pytest tests/
```

**Test Suite Coverage Summary:**
- `tests/test_api_endpoints.py`: Gemini status, sample JSON, parse/validate workflow, AI generation, and LeetCode runner endpoints.
- `tests/test_problem_json.py`: Canonical Schema v1.0 round-trip import, export, version validation, and diagnostic error handling.
- `tests/test_problem_parser.py`: Numbered lists, alternative header styles (`P1:`, `Problem 2.`, `3)`), multiline description preservation.
- `tests/test_problem_schema.py`: Pydantic models, category enums, default values, and construct validation.
- `tests/test_test_case_generation.py`: Algorithmic 50+ test synthesis for even/odd, largest-of-three, category distribution, and pack generation.
- `tests/test_test_case_validator.py`: Deterministic Python validation for calculator, characters, grades, leap years, perfect squares, signs, and swap.
- `tests/test_zip_student_id.py`: Student ID extraction (`N + 6 digits`), casing normalization, folder depth discovery, and ZIP archive validation.

### Validate Frontend TypeScript & Build:
```powershell
cd frontend
npm run build
```

---

## 📄 License

Distributed under the **MIT License**. Created for academic computer science laboratories, university programming evaluations, and competitive programming online judges.
