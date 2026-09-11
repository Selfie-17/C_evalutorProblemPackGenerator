export interface Week {
  id: string;
  week_number: number;
  title: string;
  description: string;
  status: 'draft' | 'ready' | 'evaluating' | 'evaluated';
  created_at: string;
  updated_at: string;
  problem_count: number;
  student_count: number;
  sections?: string[];
}

export interface CompilationDiagnostic {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'note';
  source_context?: string;
}

export interface CompilationResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  compiler_output: string;
  errors: CompilationDiagnostic[];
}

export interface TestCaseExecutionDetail {
  test_case_number: number;
  is_hidden: boolean;
  input?: string;
  expected_output?: string;
  actual_output?: string;
  passed: boolean;
  status: string;
  exit_code?: number;
  stderr: string;
  execution_time_ms: number;
}

export interface TestCaseSchema {
  input: string;
  expected_output: string;
}

export interface VerificationCaseResult {
  test_case_number: number;
  is_hidden: boolean;
  input: string;
  expected_output: string;
  reference_output: string;
  matched: boolean;
  status: string;
  execution_time_ms: number;
}

export interface VerificationReport {
  compiled_successfully: boolean;
  compilation_output: string;
  total_test_cases: number;
  matched_test_cases: number;
  all_matched: boolean;
  details: VerificationCaseResult[];
}

export interface ProblemInPack {
  id: string;
  week_id: string;
  number: number;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  topics: string[];
  constraints: string[];
  hints: string[];
  time_limit: number;
  input_format?: string;
  output_format?: string;
  public_test_cases: TestCaseSchema[];
  hidden_test_cases: TestCaseSchema[];
  reference_solution_c?: string;
  is_verified: boolean;
  verification_report?: VerificationReport;
}

export interface StudentProgramValidationItem {
  problem_number: number;
  found: boolean;
  filename?: string;
}

export interface StudentValidationItem {
  student_id: string;
  total_found: number;
  missing_count: number;
  programs: StudentProgramValidationItem[];
}

export interface ZipValidationReport {
  staging_token: string;
  zip_filename: string;
  section?: string;
  total_students: number;
  total_expected_programs: number;
  total_found_programs: number;
  total_missing_programs: number;
  students: StudentValidationItem[];
  warnings: string[];
}

export interface EvaluationJob {
  job_id: string;
  week_id: string;
  section?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total_students: number;
  processed_students: number;
  total_submissions: number;
  processed_submissions: number;
  current_student?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  progress_percentage: number;
}

export interface StudentSubmissionDetail {
  submission_id: string;
  problem_id: string;
  problem_number: number;
  problem_title: string;
  section?: string;
  verdict: 'ACCEPTED' | 'WRONG_ANSWER' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED' | 'NOT_SUBMITTED' | 'INTERNAL_ERROR';
  source_file: string;
  source_code: string;
  passed_test_cases: number;
  total_test_cases: number;
  total_time_ms: number;
  compilation: CompilationResult;
  test_results: TestCaseExecutionDetail[];
  submitted_at: string;
}

export interface StudentSummaryItem {
  student_id: string;
  week_id: string;
  section?: string;
  total_problems: number;
  solved_count: number;
  acceptance_rate: number;
  compilation_errors: number;
  wrong_answers: number;
  runtime_errors: number;
  tle_count: number;
  not_submitted: number;
  average_time_ms: number;
}

export interface StudentDetailResponse {
  student_id: string;
  week_id: string;
  week_number: number;
  section?: string;
  summary: StudentSummaryItem;
  submissions: StudentSubmissionDetail[];
}

export interface VerdictDistribution {
  accepted: number;
  wrong_answer: number;
  compilation_error: number;
  runtime_error: number;
  time_limit_exceeded: number;
  not_submitted: number;
}

export interface ProblemAnalyticsItem {
  problem_number: number;
  problem_id: string;
  title: string;
  difficulty: string;
  total_submissions: number;
  accepted_count: number;
  wrong_answer_count: number;
  compilation_error_count: number;
  runtime_error_count: number;
  tle_count: number;
  acceptance_rate: number;
  avg_time_ms: number;
}

export interface WeekAnalytics {
  week_id: string;
  week_number: number;
  title: string;
  section?: string | null;
  available_sections?: string[];
  total_students: number;
  total_programs: number;
  verdicts: VerdictDistribution;
  overall_acceptance_rate: number;
  avg_test_cases_passed_pct: number;
  avg_execution_time_ms: number;
  problem_stats: ProblemAnalyticsItem[];
  top_students: string[];
  struggling_students: string[];
}

export interface HealthStatus {
  status: string;
  gcc_path: string;
  gcc_available: boolean;
  gcc_version?: string;
}

// ==============================================================================
// Problem Engine & LeetCode Types
// ==============================================================================

export type TestCaseCategory =
  | 'base'
  | 'boundary'
  | 'edge'
  | 'failing'
  | 'invalid_input'
  | 'special'
  | 'stress'
  | 'metamorphic';

export type TestCaseSeverity = 'normal' | 'critical' | 'optional';
export type ValidationStatus = 'passed' | 'failed' | 'manual_review_required';

export interface TestCaseItem {
  test_id: string;
  category: TestCaseCategory;
  input: string;
  expected_output: string;
  reason: string;
  severity: TestCaseSeverity;
  validation_status?: ValidationStatus | null;
  validation_notes?: string | null;
}

export interface ClassificationModel {
  category: string;
  difficulty: string;
  required_constructs: string[];
}

export interface TestStrategyModel {
  base_cases: number;
  boundary_cases: number;
  edge_cases: number;
  failing_cases: number;
  special_cases: number;
  invalid_input_cases: number;
  stress_cases: number;
  metamorphic_cases: number;
}

export interface ProblemModel {
  problem_id: string;
  title: string;
  statement: string;
  original_statement?: string;
  requirements: string[];
  concepts: string[];
  constraints: string[];
  classification: ClassificationModel;
  test_strategy: TestStrategyModel;
  test_cases: TestCaseItem[];
  reference_solution_c?: string | null;
  division_approved: boolean;
}

export interface ProblemPackModel {
  schema_version: string;
  problem_pack_id: string;
  title: string;
  language: string;
  total_problems: number;
  problems: ProblemModel[];
  generation_status: string;
}

export interface GeminiReviewItem {
  category: TestCaseCategory;
  input: string;
  expected_output: string;
  reason: string;
  severity?: TestCaseSeverity;
}

export interface GeminiReviewReport {
  configured: boolean;
  verdict?: 'approved' | 'needs_attention' | 'critical_issues_found' | 'unreviewed' | 'error';
  coverage_score?: number;
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  suggested_test_cases?: GeminiReviewItem[];
  error?: string;
}

export interface LeetCodeExecutionResultItem {
  test_case_number: number;
  test_id?: string;
  input: string;
  expected_output?: string;
  actual_output: string;
  passed: boolean;
  status: string;
  exit_code?: number | null;
  stderr: string;
  execution_time_ms: number;
}

export interface LeetCodeExecutionResponse {
  mode: 'single' | 'batch';
  verdict?: string;
  status: string;
  stdout?: string;
  stderr?: string;
  compilation_output?: string;
  diagnostics?: CompilationDiagnostic[];
  exit_code?: number | null;
  execution_time_ms?: number;
  total_test_cases?: number;
  passed_test_cases?: number;
  total_execution_time_ms?: number;
  results?: LeetCodeExecutionResultItem[];
}

export interface RawExecuteCodeRequest {
  code: string;
  stdin?: string;
  timeout?: number;
}

export interface RawExecuteCodeResponse {
  status: 'success' | 'compilation_error' | 'runtime_error' | 'time_limit_exceeded' | 'internal_error';
  stdout: string;
  stderr: string;
  exit_code?: number | null;
  compilation_output: string;
  diagnostics: CompilationDiagnostic[];
  execution_time_ms: number;
}


