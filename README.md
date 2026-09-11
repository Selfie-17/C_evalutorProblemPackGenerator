# 🚀 C Lab Evaluator & LeetCode-Style Online Judge Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.0+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![Docker](https://img.shields.io/badge/Docker-Linux%20GCC%20C11-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com)
[![Database](https://img.shields.io/badge/Database-Aiven%20Postgres%20%7C%20SQLite-4169E1?style=flat&logo=postgresql&logoColor=white)](https://aiven.io)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=flat&logo=render&logoColor=white)](https://render.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com)
[![Tests](https://img.shields.io/badge/Tests-45%2F45%20Passing-success?style=flat&logo=pytest&logoColor=white)](tests/)

An enterprise-grade, full-stack laboratory grading, online judging, and automated problem engineering platform for C programming education. Built with a high-performance **FastAPI** backend, containerized **Linux GCC C11** execution, **Aiven PostgreSQL** (production) and **SQLite WAL** (local development), an **Intelligent Problem Pack Engine** with deterministic Python validation and dual LLMs (**Google Gemini Cloud** & **Local Ollama**), and a modern **React 19 + TypeScript + Vite** web interface.

---

## 📑 Table of Contents

- [🌟 Key System Capabilities](#-key-system-capabilities)
- [🏗️ Production Cloud Architecture](#️-production-cloud-architecture)
- [📂 Project Structure](#-project-structure)
- [📋 Prerequisites & Toolchains](#-prerequisites--toolchains)
- [⚙️ Setup & Deployment Workflows](#-setup--deployment-workflows)
  - [Option A: Local Containerized Setup (Docker Compose)](#option-a-local-containerized-setup-docker-compose)
  - [Option B: Native Windows Local Development](#option-b-native-windows-local-development)
  - [Option C: Production Cloud Deployment (Vercel + Render + Aiven + Gemini)](#option-c-production-cloud-deployment-vercel--render--aiven--gemini)
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
- [⚠️ Security Limitations & Production Considerations](#️-security-limitations--production-considerations)
- [🧪 Running the Test Suite](#-running-the-test-suite)
- [📄 License](#-license)

---

## 🌟 Key System Capabilities

### 1. ⚡ Container-Safe C11 Compilation & Execution Engine
- **Linux GCC Toolchain**: Standard C11 compiler discovery via `shutil.which` and `CC=gcc`, supporting `-std=c11 -O2 -pipe`.
- **Resource-Limited Process Isolation**: Student C programs execute inside the Linux container as a non-root `appuser` within distinct POSIX process groups (`os.setsid()`), bounded by kernel resource limits (`setrlimit`).
- **Orphan & Zombie Elimination**: Process groups are forcefully terminated on timeout using `os.killpg(pgid, signal.SIGKILL)` (with Windows `taskkill` fallback for local dev).
- **Runaway Output Protection**: Captured stdout and stderr are truncated at 1 MB to prevent buffer overflow or memory exhaustion from infinite loop printing.
- **Dedicated Temp Lifecycles**: Every compilation and run executes in a dedicated temporary directory (`c_runner_*` / `c_eval_*`) with guaranteed cleanup.
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
  - **Google Gemini Cloud**: High-speed production generation, review, and viva questions using `GEMINI_API_KEY` (no local GPU required).
  - **Local Ollama**: Optional local offline generation with GPU acceleration (`qwen2.5-coder:3b`, customizable layer offloading via `OLLAMA_NUM_GPU=99`).
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
- Real-time compiler health indicator and cloud API status in the sidebar.

---

## 🏗️ Production Cloud Architecture

```
                                 USERS
                                   │
                                   ▼
                            ┌─────────────┐
                            │   Vercel    │
                            │ React/Vite  │
                            └──────┬──────┘
                                   │ HTTPS API
                                   ▼
                            ┌─────────────┐
                            │   Render    │
                            │             │
                            │ Docker      │
                            │             │
                            │ FastAPI     │
                            │ Linux GCC   │
                            │ C Judge     │
                            └──────┬──────┘
                                   │
                      ┌────────────┼────────────┐
                      ▼            ▼            ▼
                  ┌────────┐   ┌─────────┐  ┌──────────┐
                  │ Aiven  │   │ Gemini  │  │ Storage  │
                  │   DB   │   │   API   │  │ optional │
                  └────────┘   └─────────┘  └──────────┘
```

### Production Execution Model

On Render, the backend runs inside a secure Linux Docker container:

```
Render Docker Container (non-root appuser, 0.0.0.0:$PORT)
│
├── FastAPI Server (ASGI async event loop)
├── Linux GCC Toolchain (/usr/bin/gcc, libc6-dev)
└── C Execution Layer
      │
      └── Linux subprocess (non-root)
            ├── separate process group (os.setsid())
            ├── execution timeout (DEFAULT_TIMEOUT=5s, MAX_TIMEOUT=15s)
            ├── CPU time limit (RLIMIT_CPU)
            ├── memory limit (RLIMIT_AS, 256 MB)
            ├── file output limit (RLIMIT_FSIZE)
            ├── core dump disabled (RLIMIT_CORE=0)
            ├── stdout/stderr truncation (1 MB limit)
            ├── isolated temp directory (tempfile.TemporaryDirectory)
            └── guaranteed cleanup (os.killpg SIGKILL)
```

> [!IMPORTANT]
> **Independent Cloud Operation**: Once deployed to Vercel, Render, Aiven, and Google Gemini, your personal computer is **NOT** required to run. The entire application, database, C compiler, judge, and AI generation operate independently in the cloud.

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

Choose your preferred deployment or development workflow:

| Workflow | Requirements | Best For |
| :--- | :--- | :--- |
| **Option A: Docker Compose** | Docker Desktop (Linux containers) | Quickest local dev, matches production Linux GCC environment |
| **Option B: Native Windows** | Python 3.10+, Node.js 18+, MSYS2 GCC | Native Windows development without Docker |
| **Option C: Cloud Production** | Vercel account, Render account, Aiven account, Gemini API key | Production deployment accessible 24/7 without local PC running |

---

## ⚙️ Setup & Deployment Workflows

### Option A: Local Containerized Setup (Docker Compose)

The fastest way to run the production-grade Linux backend locally without installing MSYS2 GCC or configuring paths:

1. **Clone repository and create `.env`**:
   ```powershell
   Copy-Item .env.example .env
   ```
   Add your `GEMINI_API_KEY` (if using cloud AI) to `.env`.

2. **Launch the containerized backend**:
   ```bash
   docker compose up --build
   ```
   This automatically:
   - Builds the Debian Linux container with GCC 12/13.
   - Creates the non-root `appuser`.
   - Mounts persistent volume `c_eval_data` to `/app/data`.
   - Starts FastAPI on `http://localhost:8000`.

3. **Start the React frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Access the web interface at `http://localhost:5173`.

---

### Option B: Native Windows Local Development

If you prefer native execution on Windows without Docker:

1. **Prerequisites**:
   - Python 3.10+ added to `PATH`.
   - Node.js v18+ and npm.
   - MSYS2 GCC toolchain (`pacman -S mingw-w64-ucrt-x86_64-gcc`). Default verified path: `C:\msys64\ucrt64\bin\gcc.exe`.
   - Optional: Local [Ollama](https://ollama.com/) (`ollama pull qwen2.5-coder:3b`).

2. **Backend Setup**:
   ```powershell
   # Create and activate virtual environment
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Install dependencies
   pip install -r requirements.txt

   # Configure environment
   Copy-Item .env.example .env

   # Start backend
   uvicorn app.main:app --reload --port 8000
   ```

3. **Frontend Setup**:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

---

### Option C: Production Cloud Deployment (Vercel + Render + Aiven + Gemini)

Deploy the entire platform so it runs 24/7 in the cloud without requiring your local PC to be turned on.

```
Developer PC  ──git push──>  GitHub  ───┬───>  Vercel (React Frontend)
                                        │
                                        └───>  Render (Docker Backend + Linux GCC)
                                                    ├──> Aiven (PostgreSQL)
                                                    └──> Google Gemini (AI)
```

#### Step 1: Create Aiven PostgreSQL Database
1. Sign up at [Aiven.io](https://aiven.io/) and create a free or standard **PostgreSQL** service.
2. In the Aiven console, copy the **Service URI** (e.g. `postgres://avnadmin:PASSWORD@pg-service.aivencloud.com:12345/defaultdb?sslmode=require`).
3. Note: The backend automatically converts `postgres://` to `postgresql://` and enables connection pooling with auto-reconnect (`pool_pre_ping=True`).

#### Step 2: Deploy Backend to Render
1. Sign up at [Render.com](https://render.com/) and connect your GitHub repository.
2. Click **New +** → **Web Service**.
3. Select this repository:
   - **Environment**: **Docker** (it automatically detects the root `Dockerfile`).
   - **Branch**: `main` (or your active branch).
   - **Plan**: Free or Starter.
   - **Health Check Path**: `/health`
4. Add the following **Environment Variables** in Render's dashboard:
   | Variable | Value | Notes |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | `postgresql://avnadmin:...@...:12345/defaultdb?sslmode=require` | Your Aiven Service URI |
   | `GEMINI_API_KEY` | `AIzaSy...` | Your Google Gemini API Key |
   | `LLM_PROVIDER` | `gemini` | Cloud AI provider |
   | `FRONTEND_URL` | `https://your-app.vercel.app` | Your deployed Vercel domain |
   | `MAX_EVALUATION_WORKERS` | `3` | Concurrent batch threads |
   | `DEFAULT_EXECUTION_TIMEOUT` | `5` | Default per-testcase limit |
   | `MAX_EXECUTION_TIMEOUT` | `15` | Absolute maximum timeout |
5. Click **Deploy Web Service**.
6. Render builds the Docker container, installs GCC, and runs Uvicorn on `0.0.0.0:$PORT`.
7. Once deployed, note your Render URL (e.g., `https://c-eval-backend.onrender.com`). Verify by visiting `https://c-eval-backend.onrender.com/health`.

#### Step 3: Deploy Frontend to Vercel
1. Sign up at [Vercel.com](https://vercel.com/) and import your GitHub repository.
2. Configure project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: **Vite**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add the **Environment Variable**:
   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://c-eval-backend.onrender.com` (Your Render backend URL) |
4. Click **Deploy**.
5. Once deployment completes, update the `FRONTEND_URL` variable in your Render backend settings to match your production Vercel URL (e.g. `https://your-app.vercel.app`).

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

The platform implements **Resource-limited Linux subprocess isolation inside the application container**:

1. **Non-Root Execution (`appuser`)**:
   - The production Docker image creates a dedicated unprivileged user (`RUN useradd --create-home appuser`).
   - The FastAPI server and all child compilation and execution subprocesses run strictly as `appuser`, preventing access to root system files or unauthorized container alterations.

2. **POSIX Process Group Isolation & Clean Termination**:
   - Every student binary is spawned in its own process group (`preexec_fn=os.setsid()` / `process_group=0`).
   - On timeout or completion, `os.killpg(pgid, signal.SIGKILL)` forcefully terminates the entire process tree, guaranteeing that runaway threads, child forks, or infinite loops do not leave orphan/zombie processes running.
   - For local Windows development, `subprocess.CREATE_NEW_PROCESS_GROUP` and `taskkill /F /T /PID` are retained as a fallback.

3. **Kernel Resource Limits (`resource.setrlimit`)**:
   - Under Linux/POSIX, the runner enforces strict kernel-level resource bounds:
     - `RLIMIT_CPU`: Hard CPU time limit (clamped to timeout + 1s).
     - `RLIMIT_AS`: Address space / virtual memory ceiling (default: 256 MB), preventing out-of-memory crashes or large `malloc()` attacks from affecting the FastAPI server.
     - `RLIMIT_FSIZE`: Output file write limit (prevents disk-filling attacks from student code writing large files).
     - `RLIMIT_CORE`: Core dumps disabled (`0`) to prevent disk bloat upon segmentation faults.

4. **Runaway Output Truncation**:
   - Standard output and standard error streams are capped at 1 MB (`MAX_OUTPUT_SIZE`). If a student program outputs infinite text (e.g. `while(1) printf(...)`), output is safely truncated without consuming excessive server memory.

5. **Payload Bounds & Size Validation**:
   - Source code payloads are validated prior to invoking GCC (default: 64 KB).
   - Standard input is validated before execution (default: 256 KB).

6. **Zip Slip Traversal Prevention**:
   - Archive extraction validates that all target file paths resolve strictly inside the isolated temporary staging directory (`os.path.commonpath` / `is_safe_zip_path`).
   - Malicious path components (such as `../../etc/passwd`) are rejected with immediate validation failure.

7. **Hidden Test Case Privacy**:
   - Inputs, expected outputs, and actual student output for hidden test cases (`is_hidden=True`) are masked upon evaluation failure to protect private test suites.

8. **Database Transactional Safety**:
   - SQLite operates with `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
   - Aiven PostgreSQL operates with connection pooling (`pool_pre_ping=True`, `pool_recycle=300`) to automatically recover from dropped connections.

---

## ⚠️ Security Limitations & Production Considerations

While the resource-limited Linux subprocess model inside the Render container prevents CPU starvation, memory leaks, runaway output, and orphaned processes, please review these architectural security characteristics:

| Security Dimension | Current Implementation | Dedicated Judge Cluster (Enterprise Ideal) |
| :--- | :--- | :--- |
| **Execution Environment** | Non-root Linux subprocess inside Render container | Dedicated isolated VM / microVM (e.g. Firecracker / gVisor) |
| **Memory / CPU Limits** | POSIX `setrlimit` (RLIMIT_AS, RLIMIT_CPU) | Kernel cgroups v2 / VM hypervisor bounds |
| **Process Cleanup** | POSIX process groups (`os.killpg` SIGKILL) | Container disposal per submission |
| **Network Isolation** | Shared container network (Render limitation) | Disabled network interface (`--net=none`) |
| **Filesystem Access** | Isolated temporary directory (`tempfile`) | Read-only ephemeral root with tmpfs overlay |

> [!CAUTION]
> **Production Note on Arbitrary Code Execution**:
> In Render's container environment, nested Docker or privileged container control (`docker run --net none`) is not available. Subprocess isolation with `setrlimit` and `appuser` protects the server from conventional memory/CPU exhaustion and infinite loops. However, if you intend to run untrusted public competitive programming contests at high scale, we recommend routing compilation to an independent, dedicated judge worker server equipped with Linux `isolate` / `nsjail` and network disabling.

---

## 🧪 Running the Test Suite

The platform includes a comprehensive automated test suite covering API endpoints, canonical JSON schemas, problem text parsers, 50+ test case synthesizers, deterministic Python validators, Linux compiler sandboxing, and Student ID regex extraction.

### Run All Backend Tests (45 Tests):
```bash
# Run pytest with automatic testpaths and pythonpath discovery
pytest -v
```

**Test Suite Coverage Summary (45 Passed):**
- `tests/test_compiler_sandbox.py` (10 tests):
  - Compiler health check endpoint (`GET /health`)
  - C11 compilation and execution
  - Compilation error diagnostic parsing
  - Runtime error detection (exit codes / segfaults)
  - Timeout enforcement on infinite loops & process tree termination
  - Large output truncation
  - Payload limits (code size & stdin size)
  - Judge verdicts (Accepted vs. Wrong Answer)
  - Zip Slip path traversal security
  - Database initialization and queries
- `tests/test_api_endpoints.py` (5 tests): Gemini status, sample JSON, parse/validate workflow, AI generation, LeetCode runner.
- `tests/test_problem_json.py` (5 tests): Canonical Schema v1.0 import, export, version validation, error diagnostics.
- `tests/test_problem_parser.py` (4 tests): Numbered lists, alternative header styles, multiline statement preservation.
- `tests/test_problem_schema.py` (4 tests): Pydantic models, category enums, default values, construct validation.
- `tests/test_test_case_generation.py` (4 tests): Algorithmic 50+ test synthesis for even/odd, largest-of-three, category diversity, pack generation.
- `tests/test_test_case_validator.py` (10 tests): Deterministic Python validation for calculator, characters, grades, leap years, perfect squares, signs, and swap.
- `tests/test_zip_student_id.py` (3 tests): Student ID extraction (`N + 6 digits`), casing normalization, folder depth discovery, and ZIP archive validation.

### Validate Frontend TypeScript & Build:
```bash
cd frontend
npm run build
```

---

## 📄 License

Distributed under the **MIT License**. Created for academic computer science laboratories, university programming evaluations, and competitive programming online judges.
