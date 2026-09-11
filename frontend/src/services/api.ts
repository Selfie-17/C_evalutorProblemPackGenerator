import {
  EvaluationJob,
  GeminiReviewReport,
  HealthStatus,
  LeetCodeExecutionResponse,
  ProblemInPack,
  ProblemModel,
  ProblemPackModel,
  StudentDetailResponse,
  StudentSubmissionDetail,
  StudentSummaryItem,
  Week,
  WeekAnalytics,
  ZipValidationReport,
  RawExecuteCodeResponse,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

if (typeof window !== 'undefined' && !import.meta.env.VITE_API_URL && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.warn(
    '⚠️ [VITE_API_URL] is empty in production! Requests to /api/* will hit this static host and return HTML / 405 errors. Please configure VITE_API_URL in your Vercel Project Settings to your Render backend URL.'
  );
}

export async function handleJsonResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `Received HTML (<!doctype html>) instead of JSON from backend (HTTP ${res.status}). ` +
      `This occurs when VITE_API_URL is missing or misconfigured in Vercel. ` +
      `Please set VITE_API_URL in your Vercel Project Settings to your Render backend URL (e.g. https://c-lab-evaluator-backend.onrender.com) and redeploy.`
    );
  }
  if (!res.ok) {
    if (res.status === 405) {
      throw new Error(
        `HTTP 405 Method Not Allowed on ${res.url}. Ensure VITE_API_URL is configured in your Vercel Project Settings and redeploy.`
      );
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || fallbackError);
  }
  return res.json();
}

export async function handleEmptyResponse(res: Response, fallbackError: string): Promise<void> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `Received HTML instead of API response (HTTP ${res.status}). Please verify VITE_API_URL in Vercel.`
    );
  }
  if (!res.ok) {
    if (res.status === 405) {
      throw new Error(
        `HTTP 405 Method Not Allowed on ${res.url}. Ensure VITE_API_URL is configured in your Vercel Project Settings and redeploy.`
      );
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || fallbackError);
  }
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`);
  return handleJsonResponse(res, 'Failed to fetch compiler health');
}

export async function fetchWeeks(): Promise<Week[]> {
  const res = await fetch(`${BASE_URL}/api/weeks`);
  return handleJsonResponse(res, 'Failed to fetch weeks');
}

export async function createWeek(weekNumber: number, title: string, description: string = ''): Promise<Week> {
  const res = await fetch(`${BASE_URL}/api/weeks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ week_number: weekNumber, title, description }),
  });
  return handleJsonResponse(res, 'Failed to create week');
}

export async function fetchWeek(weekId: string): Promise<Week> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}`);
  return handleJsonResponse(res, `Failed to fetch week ${weekId}`);
}

export async function deleteWeek(weekId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}`, { method: 'DELETE' });
  return handleEmptyResponse(res, `Failed to delete week ${weekId}`);
}

export async function fetchWeekProblems(weekId: string): Promise<ProblemInPack[]> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/problems`);
  return handleJsonResponse(res, `Failed to fetch problems for ${weekId}`);
}

export async function deleteWeekProblems(weekId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/problems`, { method: 'DELETE' });
  return handleEmptyResponse(res, `Failed to delete problem pack for ${weekId}`);
}

export async function deleteSingleProblem(weekId: string, problemNumberOrId: number | string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/problems/${problemNumberOrId}`, { method: 'DELETE' });
  return handleEmptyResponse(res, `Failed to delete problem ${problemNumberOrId}`);
}

export async function seedDefaultPack(weekId: string): Promise<ProblemInPack[]> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/seed-default-pack`, {
    method: 'POST',
  });
  return handleJsonResponse(res, 'Failed to seed default problem pack');
}

export async function generateProblemPack(
  weekId: string,
  options: {
    number_of_problems?: number;
    difficulty?: string;
    topics?: string[];
    verify_with_reference?: boolean;
    provider?: string;
    model?: string;
    api_key?: string;
  }
): Promise<{ week_id: string; status: string; total_generated: number; total_verified: number; problems: ProblemInPack[]; errors: string[] }> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/generate-pack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  return handleJsonResponse(res, 'Failed to generate problem pack');
}

export async function generateFromQuestions(
  weekId: string,
  options: {
    raw_text?: string;
    questions?: string[];
    difficulty?: string;
    verify_with_reference?: boolean;
    provider?: string;
    model?: string;
    api_key?: string;
    replace_all?: boolean;
  }
): Promise<{ week_id: string; status: string; total_generated: number; total_verified: number; problems: ProblemInPack[]; errors: string[] }> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/generate-from-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  return handleJsonResponse(res, 'Failed to generate problems from questions');
}

export async function validateSubmissionZip(
  weekId: string,
  file: File,
  section?: string,
): Promise<ZipValidationReport> {
  const formData = new FormData();
  formData.append('file', file);
  if (section) {
    formData.append('section', section);
  }
  const secQuery = section ? `?section=${encodeURIComponent(section)}` : '';
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/submissions/validate-zip${secQuery}`, {
    method: 'POST',
    body: formData,
  });
  return handleJsonResponse(res, 'Failed to validate ZIP');
}

export async function startEvaluation(
  weekId: string,
  stagingToken: string,
  continueOnError: boolean = true,
  section?: string,
): Promise<EvaluationJob> {
  const res = await fetch(`${BASE_URL}/api/evaluations/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      week_id: weekId,
      staging_token: stagingToken,
      continue_on_error: continueOnError,
      section: section || 'Section A',
    }),
  });
  return handleJsonResponse(res, 'Failed to start evaluation');
}

export async function fetchEvaluationProgress(jobId: string): Promise<EvaluationJob> {
  const res = await fetch(`${BASE_URL}/api/evaluations/${jobId}/progress`);
  return handleJsonResponse(res, 'Failed to fetch job progress');
}

export async function fetchWeekStudents(weekId: string, section?: string): Promise<StudentSummaryItem[]> {
  const query = section && section.toLowerCase() !== 'all' ? `?section=${encodeURIComponent(section)}` : '';
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/students${query}`);
  return handleJsonResponse(res, 'Failed to fetch students list');
}

export async function fetchStudentDetail(weekId: string, studentId: string): Promise<StudentDetailResponse> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/students/${studentId}`);
  return handleJsonResponse(res, `Failed to fetch student ${studentId}`);
}

export async function fetchSubmissionDetail(
  weekId: string,
  studentId: string,
  problemNumber: number
): Promise<StudentSubmissionDetail> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/students/${studentId}/submissions/${problemNumber}`);
  return handleJsonResponse(res, 'Failed to fetch submission details');
}

export async function fetchWeekAnalytics(weekId: string, section?: string): Promise<WeekAnalytics> {
  const query = section && section.toLowerCase() !== 'all' ? `?section=${encodeURIComponent(section)}` : '';
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/analytics${query}`);
  return handleJsonResponse(res, 'Failed to fetch analytics');
}

export function getExportProblemPackUrl(weekId: string): string {
  return `${BASE_URL}/api/weeks/${weekId}/export-pack`;
}

export function getExportStudentJsonUrl(weekId: string, studentId: string): string {
  return `${BASE_URL}/api/weeks/${weekId}/students/${studentId}/export`;
}

export function getExportWeekJsonUrl(weekId: string, section?: string): string {
  const query = section && section.toLowerCase() !== 'all' ? `?section=${encodeURIComponent(section)}` : '';
  return `${BASE_URL}/api/weeks/${weekId}/export/json${query}`;
}

export function getExportWeekZipUrl(weekId: string, section?: string): string {
  const query = section && section.toLowerCase() !== 'all' ? `?section=${encodeURIComponent(section)}` : '';
  return `${BASE_URL}/api/weeks/${weekId}/export/zip${query}`;
}

// ==============================================================================
// Problem Engine API Client
// ==============================================================================

export async function fetchGeminiStatus(): Promise<{ configured: boolean; model: string }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/gemini-status`);
  return handleJsonResponse(res, 'Failed to fetch Gemini status');
}

export async function fetchSampleProblemPack(): Promise<ProblemPackModel> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/sample-json`);
  return handleJsonResponse(res, 'Failed to fetch sample problem pack');
}

export async function fetchSampleProblemJson(): Promise<ProblemModel> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/sample-problem-json`);
  return handleJsonResponse(res, 'Failed to fetch sample single problem');
}


export async function parseProblemText(
  rawText: string,
  packId: string = 'week-01',
  title: string = 'C Laboratory Problem Pack'
): Promise<{ pack: ProblemPackModel }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText, pack_id: packId, title }),
  });
  return handleJsonResponse(res, 'Failed to parse problem text');
}

export async function classifyProblemPack(pack: ProblemPackModel): Promise<{ pack: ProblemPackModel }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pack),
  });
  return handleJsonResponse(res, 'Failed to classify problems');
}

export async function validateProblemPackJson(
  rawContent: any
): Promise<{ valid: boolean; error: string | null; pack: ProblemPackModel | null }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/validate-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_content: rawContent }),
  });
  return handleJsonResponse(res, 'Failed to validate JSON');
}

export async function generateProblemTestCases(
  problem: ProblemModel,
  provider: 'qwen' | 'gemini' = 'qwen',
  targetCount: number = 50,
  geminiApiKey?: string
): Promise<{ problem: ProblemModel }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/generate-problem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      problem,
      provider,
      target_count: targetCount,
      gemini_api_key: geminiApiKey || undefined,
    }),
  });
  return handleJsonResponse(res, 'Failed to generate test cases');
}

export async function generatePackTestCases(
  pack: ProblemPackModel,
  provider: 'qwen' | 'gemini' = 'qwen',
  targetCount: number = 50,
  geminiApiKey?: string
): Promise<{ pack: ProblemPackModel }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/generate-pack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pack,
      provider,
      target_count: targetCount,
      gemini_api_key: geminiApiKey || undefined,
    }),
  });
  return handleJsonResponse(res, 'Failed to generate problem pack test cases');
}

export async function validateTestCases(problem: ProblemModel): Promise<{ problem: ProblemModel }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/validate-test-cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(problem),
  });
  return handleJsonResponse(res, 'Failed to validate test cases');
}

export async function reviewProblemWithGemini(
  problem: ProblemModel,
  geminiApiKey?: string
): Promise<{ review: GeminiReviewReport }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/gemini-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      problem,
      gemini_api_key: geminiApiKey || undefined,
    }),
  });
  return handleJsonResponse(res, 'Gemini review failed');
}

export async function deployProblemPackToWeek(
  weekId: string,
  pack: ProblemPackModel,
  replaceAll: boolean = false
): Promise<{ success: boolean; deployed_problems: number; message: string }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/deploy-to-week/${weekId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pack, replace_all: replaceAll }),
  });
  return handleJsonResponse(res, 'Failed to deploy problem pack to week');
}

export async function runLeetCodeExecution(payload: {
  code: string;
  test_cases?: { test_id?: string; input: string; expected_output?: string }[];
  custom_stdin?: string;
  timeout?: number;
}): Promise<LeetCodeExecutionResponse> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/run-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, 'Code execution failed');
}

export async function verifyProblemTestCases(payload: {
  problem_id?: string;
  code?: string;
  test_cases?: { id?: string; test_id?: string; input: string; expected_output: string }[];
}): Promise<{
  status: string;
  is_valid: boolean;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  discrepancies: Array<{
    test_case_number?: number;
    test_id?: string;
    status: string;
    input: string;
    expected_output: string;
    reference_output: string;
    reason: string;
  }>;
}> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/verify-problem-testcases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, 'Testcase verification failed');
}

export async function calibrateProblemTestCases(payload: {
  problem_id?: string;
  code?: string;
  test_cases?: { id?: string; test_id?: string; input: string; expected_output: string }[];
}): Promise<{
  status: string;
  message: string;
  total_cases: number;
  calibrated_count: number;
  public_test_cases?: any[];
  hidden_test_cases?: any[];
}> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/calibrate-problem-testcases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, 'Testcase calibration failed');
}

export async function executeRawCode(
  code: string,
  stdin: string = '',
  timeout: number = 5.0
): Promise<RawExecuteCodeResponse> {
  const res = await fetch(`${BASE_URL}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, stdin, timeout }),
  });
  return handleJsonResponse<RawExecuteCodeResponse>(res, 'Failed to compile and run code');
}




