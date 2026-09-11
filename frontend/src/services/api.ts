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
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Failed to fetch compiler health');
  return res.json();
}

export async function fetchWeeks(): Promise<Week[]> {
  const res = await fetch(`${BASE_URL}/api/weeks`);
  if (!res.ok) throw new Error('Failed to fetch weeks');
  return res.json();
}

export async function createWeek(weekNumber: number, title: string, description: string = ''): Promise<Week> {
  const res = await fetch(`${BASE_URL}/api/weeks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ week_number: weekNumber, title, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create week');
  }
  return res.json();
}

export async function fetchWeek(weekId: string): Promise<Week> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}`);
  if (!res.ok) throw new Error(`Failed to fetch week ${weekId}`);
  return res.json();
}

export async function deleteWeek(weekId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete week ${weekId}`);
}

export async function fetchWeekProblems(weekId: string): Promise<ProblemInPack[]> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/problems`);
  if (!res.ok) throw new Error(`Failed to fetch problems for ${weekId}`);
  return res.json();
}

export async function deleteWeekProblems(weekId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/problems`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete problem pack for ${weekId}`);
}

export async function deleteSingleProblem(weekId: string, problemNumberOrId: number | string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/problems/${problemNumberOrId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete problem ${problemNumberOrId}`);
}

export async function seedDefaultPack(weekId: string): Promise<ProblemInPack[]> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/seed-default-pack`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to seed default problem pack');
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate problem pack');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate problems from questions');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to validate ZIP');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start evaluation');
  }
  return res.json();
}

export async function fetchEvaluationProgress(jobId: string): Promise<EvaluationJob> {
  const res = await fetch(`${BASE_URL}/api/evaluations/${jobId}/progress`);
  if (!res.ok) throw new Error('Failed to fetch job progress');
  return res.json();
}

export async function fetchWeekStudents(weekId: string, section?: string): Promise<StudentSummaryItem[]> {
  const query = section && section.toLowerCase() !== 'all' ? `?section=${encodeURIComponent(section)}` : '';
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/students${query}`);
  if (!res.ok) throw new Error('Failed to fetch students list');
  return res.json();
}

export async function fetchStudentDetail(weekId: string, studentId: string): Promise<StudentDetailResponse> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/students/${studentId}`);
  if (!res.ok) throw new Error(`Failed to fetch student ${studentId}`);
  return res.json();
}

export async function fetchSubmissionDetail(
  weekId: string,
  studentId: string,
  problemNumber: number
): Promise<StudentSubmissionDetail> {
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/students/${studentId}/submissions/${problemNumber}`);
  if (!res.ok) throw new Error('Failed to fetch submission details');
  return res.json();
}

export async function fetchWeekAnalytics(weekId: string, section?: string): Promise<WeekAnalytics> {
  const query = section && section.toLowerCase() !== 'all' ? `?section=${encodeURIComponent(section)}` : '';
  const res = await fetch(`${BASE_URL}/api/weeks/${weekId}/analytics${query}`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
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
  if (!res.ok) throw new Error('Failed to fetch Gemini status');
  return res.json();
}

export async function fetchSampleProblemPack(): Promise<ProblemPackModel> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/sample-json`);
  if (!res.ok) throw new Error('Failed to fetch sample problem pack');
  return res.json();
}

export async function fetchSampleProblemJson(): Promise<ProblemModel> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/sample-problem-json`);
  if (!res.ok) throw new Error('Failed to fetch sample single problem');
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to parse problem text');
  }
  return res.json();
}

export async function classifyProblemPack(pack: ProblemPackModel): Promise<{ pack: ProblemPackModel }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pack),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to classify problems');
  }
  return res.json();
}

export async function validateProblemPackJson(
  rawContent: any
): Promise<{ valid: boolean; error: string | null; pack: ProblemPackModel | null }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/validate-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_content: rawContent }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to validate JSON');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate test cases');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate problem pack test cases');
  }
  return res.json();
}

export async function validateTestCases(problem: ProblemModel): Promise<{ problem: ProblemModel }> {
  const res = await fetch(`${BASE_URL}/api/problem-engine/validate-test-cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(problem),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to validate test cases');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Gemini review failed');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to deploy problem pack to week');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Code execution failed');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Testcase verification failed');
  }
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Testcase calibration failed');
  }
  return res.json();
}


