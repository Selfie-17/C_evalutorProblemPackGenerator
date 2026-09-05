import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Code2,
  FileText,
  ListFilter,
  Sparkles,
  Terminal,
  ExternalLink,
  ChevronRight,
  Search,
  Plus,
  Check,
  Copy,
  ShieldCheck,
  RefreshCw,
  Filter,
  Award,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import {
  GeminiReviewReport,
  LeetCodeExecutionResponse,
  LeetCodeExecutionResultItem,
  ProblemModel,
  TestCaseCategory,
  TestCaseItem,
} from '../types';
import {
  reviewProblemWithGemini,
  runLeetCodeExecution,
  verifyProblemTestCases,
  calibrateProblemTestCases,
} from '../services/api';

interface LeetCodeProblemViewProps {
  problem: ProblemModel;
  onClose: () => void;
  geminiApiKey?: string;
  onUpdateProblem?: (updated: ProblemModel) => void;
}

const DEFAULT_C_TEMPLATE = `#include <stdio.h>

int main() {
    // Write your C solution here
    
    return 0;
}
`;

export function LeetCodeProblemView({
  problem,
  onClose,
  geminiApiKey,
  onUpdateProblem,
}: LeetCodeProblemViewProps) {
  // Left Panel Tabs
  const [leftTab, setLeftTab] = useState<'description' | 'testcases' | 'review'>('description');
  const [testCaseCategoryFilter, setTestCaseCategoryFilter] = useState<string>('all');
  const [testCaseSearch, setTestCaseSearch] = useState('');

  // Right Panel Code & Runner
  const [code, setCode] = useState<string>(() => {
    return problem.reference_solution_c || DEFAULT_C_TEMPLATE;
  });
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);
  const [customInput, setCustomInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runResponse, setRunResponse] = useState<LeetCodeExecutionResponse | null>(null);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcase' | 'result'>('testcase');
  const [resultFilter, setResultFilter] = useState<'all' | 'failed' | 'passed'>('all');
  const [copiedInputIdx, setCopiedInputIdx] = useState<number | null>(null);

  // Test Suite Verification & Calibration State
  const [isVerifyingSuite, setIsVerifyingSuite] = useState<boolean>(false);
  const [isCalibratingSuite, setIsCalibratingSuite] = useState<boolean>(false);
  const [suiteVerificationReport, setSuiteVerificationReport] = useState<any | null>(null);
  const [suiteCalibrateSuccess, setSuiteCalibrateSuccess] = useState<string | null>(null);

  // Gemini Review State
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [reviewData, setReviewData] = useState<GeminiReviewReport | null>(null);

  // New test case modal / inline form
  const [showAddTestCase, setShowAddTestCase] = useState<boolean>(false);
  const [newTcInput, setNewTcInput] = useState('');
  const [newTcOutput, setNewTcOutput] = useState('');
  const [newTcReason, setNewTcReason] = useState('');
  const [newTcCategory, setNewTcCategory] = useState<TestCaseCategory>('base');

  const testCases = problem.test_cases || [];

  const filteredTestCases = testCases.filter((tc) => {
    const matchesCategory =
      testCaseCategoryFilter === 'all' || tc.category.toLowerCase() === testCaseCategoryFilter.toLowerCase();
    const matchesSearch =
      !testCaseSearch.trim() ||
      tc.test_id.toLowerCase().includes(testCaseSearch.toLowerCase()) ||
      tc.input.toLowerCase().includes(testCaseSearch.toLowerCase()) ||
      tc.reason.toLowerCase().includes(testCaseSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeTestCase: TestCaseItem | undefined = testCases[selectedCaseIndex];

  // Handle Tab key in code editor for proper 4-space indenting
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  // Run single test case or custom input (GFG "Compile & Run")
  const handleRunSingle = async () => {
    setIsRunning(true);
    setActiveConsoleTab('result');
    try {
      if (isCustomMode) {
        const resp = await runLeetCodeExecution({
          code,
          custom_stdin: customInput,
        });
        setRunResponse(resp);
        setResultFilter('all');
      } else if (activeTestCase) {
        const resp = await runLeetCodeExecution({
          code,
          test_cases: [
            {
              test_id: activeTestCase.test_id,
              input: activeTestCase.input,
              expected_output: activeTestCase.expected_output,
            },
          ],
        });
        setRunResponse(resp);
        if (resp.verdict === 'Accepted') {
          setResultFilter('all');
        } else {
          setResultFilter('failed');
        }
      }
    } catch (err: any) {
      setRunResponse({
        mode: 'single',
        status: 'internal_error',
        verdict: 'Internal Error',
        stderr: err.message || 'Execution error',
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Run all 50+ test cases (GFG "Submit")
  const handleRunAll = async () => {
    if (testCases.length === 0) return;
    setIsRunning(true);
    setActiveConsoleTab('result');
    try {
      const resp = await runLeetCodeExecution({
        code,
        test_cases: testCases.map((tc) => ({
          test_id: tc.test_id,
          input: tc.input,
          expected_output: tc.expected_output,
        })),
        timeout: 3.0,
      });
      setRunResponse(resp);
      if (resp.passed_test_cases !== undefined && resp.passed_test_cases < (resp.total_test_cases || 0)) {
        setResultFilter('failed');
      } else {
        setResultFilter('all');
      }
    } catch (err: any) {
      setRunResponse({
        mode: 'batch',
        status: 'internal_error',
        verdict: 'Internal Error',
        stderr: err.message || 'Execution error',
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Verify test cases validity against reference solution
  const handleVerifySuite = async () => {
    setIsVerifyingSuite(true);
    setSuiteCalibrateSuccess(null);
    try {
      const res = await verifyProblemTestCases({
        problem_id: problem.problem_id,
        code: problem.reference_solution_c || code,
        test_cases: testCases.map((tc) => ({
          test_id: tc.test_id,
          input: tc.input,
          expected_output: tc.expected_output,
        })),
      });
      setSuiteVerificationReport(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsVerifyingSuite(false);
    }
  };

  // Calibrate test cases with reference solution
  const handleCalibrateSuite = async () => {
    setIsCalibratingSuite(true);
    try {
      const res = await calibrateProblemTestCases({
        problem_id: problem.problem_id,
        code: problem.reference_solution_c || code,
        test_cases: testCases.map((tc) => ({
          test_id: tc.test_id,
          input: tc.input,
          expected_output: tc.expected_output,
        })),
      });
      setSuiteCalibrateSuccess(res.message);
      if (res.public_test_cases || res.hidden_test_cases) {
        const allUpdated = [...(res.public_test_cases || []), ...(res.hidden_test_cases || [])];
        if (allUpdated.length > 0 && onUpdateProblem) {
          const updatedProblem: ProblemModel = {
            ...problem,
            test_cases: allUpdated.map((tc: any, i: number) => ({
              test_id: tc.id || tc.test_id || `Case-${i + 1}`,
              category: tc.category || 'base',
              input: tc.input,
              expected_output: tc.expected_output,
              reason: tc.reason || 'Calibrated case',
              severity: tc.severity || 'normal',
              validation_status: 'passed',
              validation_notes: 'Calibrated with C reference solution',
            })),
          };
          onUpdateProblem(updatedProblem);
        }
      }
      await handleVerifySuite();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsCalibratingSuite(false);
    }
  };

  // Run Gemini review
  const handleRunReview = async () => {
    setIsReviewing(true);
    try {
      const res = await reviewProblemWithGemini(problem, geminiApiKey);
      setReviewData(res.review);
      setLeftTab('review');
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsReviewing(false);
    }
  };

  // Add custom testcase to problem
  const handleAddTestCaseToProblem = () => {
    if (!newTcInput.trim()) return;
    const newCase: TestCaseItem = {
      test_id: `${problem.problem_id}-T${testCases.length + 1 < 10 ? '0' : ''}${testCases.length + 1}`,
      category: newTcCategory,
      input: newTcInput.endsWith('\n') ? newTcInput : newTcInput + '\n',
      expected_output: newTcOutput.endsWith('\n') ? newTcOutput : newTcOutput + '\n',
      reason: newTcReason || 'Custom user testcase',
      severity: 'normal',
      validation_status: 'manual_review_required',
      validation_notes: 'User added testcase',
    };
    const updated = {
      ...problem,
      test_cases: [...testCases, newCase],
    };
    if (onUpdateProblem) onUpdateProblem(updated);
    setNewTcInput('');
    setNewTcOutput('');
    setNewTcReason('');
    setShowAddTestCase(false);
  };

  // GFG Difficulty theme styling
  const diff = problem.classification.difficulty.toLowerCase();
  const diffBg = diff === 'easy' ? '#e6f4ea' : diff === 'medium' ? '#fff7ed' : '#fef2f2';
  const diffColor = diff === 'easy' ? '#2b8a3e' : diff === 'medium' ? '#c2410c' : '#b91c1c';
  const diffBorder = diff === 'easy' ? '#b7eb8f' : diff === 'medium' ? '#fed7aa' : '#fecaca';

  // Sample test cases for GFG Example 1 & Example 2
  const exampleTestCases = testCases.slice(0, 2);

  // Line count for code gutter
  const lineCount = Math.max(code.split('\n').length, 25);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: '#f8fafc',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ==================================================================== */}
      {/* TOP NAVIGATION BAR - GFG PRACTICE STYLE */}
      {/* ==================================================================== */}
      <header
        style={{
          height: '56px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Left Problem Info & GFG Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#f8fafc')}
          >
            <ArrowLeft size={15} />
            <span>Problems</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* GFG Problem Identifier */}
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#ebfbee',
                color: '#2b8a3e',
                border: '1px solid #b7eb8f',
              }}
            >
              {problem.problem_id}
            </span>

            {/* Problem Title */}
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {problem.title}
            </h1>

            {/* GFG Difficulty Badge */}
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '6px',
                color: diffColor,
                background: diffBg,
                border: `1px solid ${diffBorder}`,
                letterSpacing: '0.04em',
              }}
            >
              {problem.classification.difficulty}
            </span>

            {/* GFG Category Pill */}
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '6px',
                color: '#64748b',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                fontWeight: 500,
              }}
            >
              {problem.classification.category}
            </span>

            {/* GFG Accuracy / Points Pill */}
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '6px',
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Award size={12} />
              <span>Points: 2</span>
            </span>
          </div>
        </div>

        {/* Right Action Controls (GFG Style: Reset, Load Solution, Compile & Run, Submit) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick template helpers */}
          {problem.reference_solution_c && (
            <button
              onClick={() => setCode(problem.reference_solution_c!)}
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Load verified reference C code into the editor"
            >
              <CheckCircle2 size={13} />
              <span>Load Solution</span>
            </button>
          )}

          <button
            onClick={() => setCode(DEFAULT_C_TEMPLATE)}
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '6px 10px',
              borderRadius: '6px',
              background: '#ffffff',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            title="Reset code editor to starter template"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          {/* GFG Compile & Run Button */}
          <button
            onClick={handleRunSingle}
            disabled={isRunning}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              color: '#1e293b',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Play size={13} fill="#1e293b" />
            <span>{isRunning ? 'Running...' : 'Compile & Run'}</span>
          </button>

          {/* GFG Submit Button (Signature Green) */}
          <button
            onClick={handleRunAll}
            disabled={isRunning || testCases.length === 0}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#2f9e44',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(47, 158, 68, 0.35)',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#288c3a')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#2f9e44')}
          >
            <Zap size={14} fill="#ffffff" />
            <span>Submit ({testCases.length})</span>
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MAIN SPLIT LAYOUT (GFG PRACTICE TWO-PANE LAYOUT) */}
      {/* ==================================================================== */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '48% 52%', overflow: 'hidden' }}>
        {/* ==================================================================== */}
        {/* LEFT PANE: Problem Description, Test Suite & AI Review */}
        {/* ==================================================================== */}
        <div
          style={{
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#ffffff',
          }}
        >
          {/* Left GFG Tab Bar */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              padding: '0 12px',
            }}
          >
            <button
              onClick={() => setLeftTab('description')}
              style={{
                padding: '12px 16px',
                fontSize: '0.85rem',
                fontWeight: leftTab === 'description' ? 700 : 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: leftTab === 'description' ? '#2f9e44' : '#64748b',
                borderBottom: leftTab === 'description' ? '3px solid #2f9e44' : '3px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={15} />
              <span>Problem</span>
            </button>

            <button
              onClick={() => setLeftTab('testcases')}
              style={{
                padding: '12px 16px',
                fontSize: '0.85rem',
                fontWeight: leftTab === 'testcases' ? 700 : 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: leftTab === 'testcases' ? '#2f9e44' : '#64748b',
                borderBottom: leftTab === 'testcases' ? '3px solid #2f9e44' : '3px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <ListFilter size={15} />
              <span>Test Suite ({testCases.length})</span>
            </button>

            <button
              onClick={() => setLeftTab('review')}
              style={{
                padding: '12px 16px',
                fontSize: '0.85rem',
                fontWeight: leftTab === 'review' ? 700 : 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: leftTab === 'review' ? '#7e22ce' : '#64748b',
                borderBottom: leftTab === 'review' ? '3px solid #7e22ce' : '3px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={15} />
              <span>Gemini Review</span>
            </button>
          </div>

          {/* Left Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
            {/* ------------------------------------------------------------- */}
            {/* TAB 1: GFG PROBLEM DESCRIPTION */}
            {/* ------------------------------------------------------------- */}
            {leftTab === 'description' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
                    {problem.title}
                  </h2>
                  <div
                    style={{
                      fontSize: '0.94rem',
                      lineHeight: 1.7,
                      color: '#334155',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {problem.statement}
                  </div>
                </div>

                {/* GFG Signature Example Boxes */}
                {exampleTestCases.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#64748b',
                        letterSpacing: '0.05em',
                        margin: '0 0 10px',
                      }}
                    >
                      Examples
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {exampleTestCases.map((ex, idx) => (
                        <div
                          key={ex.test_id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderLeft: '4px solid #2f9e44',
                            borderRadius: '6px',
                            padding: '12px 16px',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginBottom: '8px' }}>
                            Example {idx + 1}:
                          </div>
                          <div
                            style={{
                              fontFamily: 'Consolas, "Fira Code", monospace',
                              fontSize: '0.83rem',
                              lineHeight: 1.6,
                              color: '#1e293b',
                            }}
                          >
                            <div>
                              <strong style={{ color: '#475569' }}>Input: </strong>
                              <span style={{ color: '#0f172a' }}>{ex.input.trim()}</span>
                            </div>
                            <div>
                              <strong style={{ color: '#475569' }}>Output: </strong>
                              <span style={{ color: '#2b8a3e', fontWeight: 700 }}>
                                {ex.expected_output.trim()}
                              </span>
                            </div>
                            {ex.reason && (
                              <div style={{ marginTop: '4px', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                                <strong style={{ color: '#475569' }}>Explanation: </strong>
                                <span>{ex.reason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* GFG "Your Task" Section */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#15803d', marginBottom: '6px' }}>
                    Your Task:
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#166534', lineHeight: 1.6 }}>
                    You don't need to read input or print anything. Complete the standard C program solution to satisfy all test cases and produce the exact expected output.
                  </p>
                </div>

                {/* GFG Complexities */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '10px 14px',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.82rem',
                    color: '#475569',
                  }}
                >
                  <div>
                    <strong>Expected Time Complexity: </strong>
                    <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>O(1)</span>
                  </div>
                  <div>
                    <strong>Expected Auxiliary Space: </strong>
                    <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>O(1)</span>
                  </div>
                </div>

                {/* Requirements (if any) */}
                {problem.requirements && problem.requirements.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#64748b',
                        letterSpacing: '0.05em',
                        margin: '0 0 8px',
                      }}
                    >
                      Functional Requirements
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '0.88rem', lineHeight: 1.65 }}>
                      {problem.requirements.map((req, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Constraints */}
                {problem.constraints && problem.constraints.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#64748b',
                        letterSpacing: '0.05em',
                        margin: '0 0 8px',
                      }}
                    >
                      Constraints
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {problem.constraints.map((c, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#1e293b',
                            fontSize: '0.83rem',
                            fontFamily: 'Consolas, monospace',
                          }}
                        >
                          <span style={{ color: '#2f9e44', fontWeight: 700 }}>•</span>
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Concepts & Topic Tags (GFG Style) */}
                <div>
                  <h3
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#64748b',
                      letterSpacing: '0.05em',
                      margin: '0 0 10px',
                    }}
                  >
                    Topic Tags
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {problem.concepts.map((concept, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.78rem',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                          fontWeight: 500,
                        }}
                      >
                        #{concept}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 2: TEST SUITE & GROUND-TRUTH VERIFICATION */}
            {/* ------------------------------------------------------------- */}
            {leftTab === 'testcases' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Suite Verification & Calibration Control Bar */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} color="#2f9e44" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        Test Suite Ground-Truth Verification
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleVerifySuite}
                        disabled={isVerifyingSuite || isCalibratingSuite}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <RefreshCw size={12} className={isVerifyingSuite ? 'animate-spin' : ''} />
                        <span>{isVerifyingSuite ? 'Verifying...' : 'Verify Test Cases'}</span>
                      </button>

                      <button
                        onClick={handleCalibrateSuite}
                        disabled={isVerifyingSuite || isCalibratingSuite}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#059669',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Sparkles size={12} className={isCalibratingSuite ? 'animate-spin' : ''} />
                        <span>{isCalibratingSuite ? 'Calibrating...' : 'Auto-Calibrate Outputs'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Verification Banner */}
                  {suiteVerificationReport && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: suiteVerificationReport.is_valid ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${suiteVerificationReport.is_valid ? '#a7f3d0' : '#fecaca'}`,
                        color: suiteVerificationReport.is_valid ? '#065f46' : '#991b1b',
                        fontWeight: 500,
                      }}
                    >
                      <span>
                        {suiteVerificationReport.is_valid
                          ? `✓ All ${suiteVerificationReport.total_cases} test cases verified & valid against C reference solution!`
                          : `⚠ ${suiteVerificationReport.failed_cases} of ${suiteVerificationReport.total_cases} test cases have discrepancies with C reference solution.`}
                      </span>
                      {!suiteVerificationReport.is_valid && (
                        <button
                          onClick={handleCalibrateSuite}
                          disabled={isCalibratingSuite}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            background: '#2f9e44',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Auto-Fix Now
                        </button>
                      )}
                    </div>
                  )}

                  {/* Calibrate Success message */}
                  {suiteCalibrateSuccess && (
                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                      }}
                    >
                      ✓ {suiteCalibrateSuccess}
                    </div>
                  )}
                </div>

                {/* Filters and search */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                      size={14}
                      style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }}
                    />
                    <input
                      type="text"
                      placeholder="Search test cases by input/id..."
                      value={testCaseSearch}
                      onChange={(e) => setTestCaseSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        borderRadius: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontSize: '0.82rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <button
                    onClick={() => setShowAddTestCase(true)}
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      color: '#2f9e44',
                      border: '1px solid #2f9e44',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} />
                    <span>Add Test</span>
                  </button>
                </div>

                {/* Category Pills (GFG Style) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    'all',
                    'base',
                    'boundary',
                    'edge',
                    'failing',
                    'special',
                    'stress',
                    'metamorphic',
                  ].map((cat) => {
                    const count =
                      cat === 'all'
                        ? testCases.length
                        : testCases.filter((tc) => tc.category === cat).length;
                    if (count === 0 && cat !== 'all') return null;
                    const isActive = testCaseCategoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setTestCaseCategoryFilter(cat)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: isActive ? '#2f9e44' : '#f1f5f9',
                          color: isActive ? '#ffffff' : '#475569',
                          border: isActive ? '1px solid #2f9e44' : '1px solid #e2e8f0',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Inline Add Test Case Form */}
                {showAddTestCase && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #2f9e44',
                      borderRadius: '8px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2f9e44' }}>
                      Add Custom Test Case
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>
                          Stdin Input:
                        </label>
                        <input
                          type="text"
                          value={newTcInput}
                          onChange={(e) => setNewTcInput(e.target.value)}
                          placeholder="e.g. 2024"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#0f172a',
                            borderRadius: '4px',
                            fontSize: '0.82rem',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>
                          Expected Output:
                        </label>
                        <input
                          type="text"
                          value={newTcOutput}
                          onChange={(e) => setNewTcOutput(e.target.value)}
                          placeholder="e.g. Leap Year"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#0f172a',
                            borderRadius: '4px',
                            fontSize: '0.82rem',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddTestCase(false)}
                        style={{
                          fontSize: '0.76rem',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTestCaseToProblem}
                        style={{
                          fontSize: '0.76rem',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          background: '#2f9e44',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Save Case
                      </button>
                    </div>
                  </div>
                )}

                {/* Test Cases Table / List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredTestCases.map((tc, idx) => {
                    const isSelected = selectedCaseIndex === idx && !isCustomMode;
                    return (
                      <div
                        key={tc.test_id}
                        onClick={() => {
                          setSelectedCaseIndex(idx);
                          setIsCustomMode(false);
                          setActiveConsoleTab('testcase');
                        }}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: isSelected ? '#f0fdf4' : '#ffffff',
                          border: isSelected ? '1px solid #2f9e44' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                              {tc.test_id}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                color: '#64748b',
                                textTransform: 'capitalize',
                                fontWeight: 500,
                              }}
                            >
                              {tc.category}
                            </span>
                            {(() => {
                              const executionResult = runResponse?.results?.find(
                                (r) => r.test_id === tc.test_id || r.test_case_number === idx + 1
                              );
                              if (executionResult) {
                                return (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      color: executionResult.passed ? '#15803d' : '#b91c1c',
                                      background: executionResult.passed ? '#dcfce7' : '#fee2e2',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      border: `1px solid ${
                                        executionResult.passed ? '#86efac' : '#fca5a5'
                                      }`,
                                    }}
                                  >
                                    {executionResult.passed ? '✓ Passed' : '✗ Failed'}
                                  </span>
                                );
                              }
                              if (tc.validation_status === 'passed') {
                                return (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      color: '#15803d',
                                      background: '#dcfce7',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #86efac',
                                      fontWeight: 600,
                                    }}
                                  >
                                    ✓ Verified
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tc.reason}
                          </div>
                        </div>

                        {/* Input & Expected Snippet */}
                        <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                          <div style={{ color: '#475569' }}>in: {tc.input.trim()}</div>
                          <div style={{ color: '#2b8a3e', fontWeight: 600 }}>exp: {tc.expected_output.trim()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 3: GEMINI AI REVIEW */}
            {/* ------------------------------------------------------------- */}
            {leftTab === 'review' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: '#faf5ff',
                    border: '1px solid #e9d5ff',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={18} color="#9333ea" />
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#581c87' }}>
                        Gemini Flash Review
                      </span>
                    </div>
                    <button
                      onClick={handleRunReview}
                      disabled={isReviewing}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: '#9333ea',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {isReviewing ? 'Analyzing...' : 'Run Gemini Review'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: '#6b21a8', margin: 0, lineHeight: 1.5 }}>
                    Critically audits coverage density, corner-case robustness, and identifies hidden logic pitfalls in student solutions.
                  </p>
                </div>

                {reviewData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Coverage Score */}
                    {reviewData.coverage_score !== undefined && (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                            Coverage Completeness Score
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2563eb' }}>
                            {reviewData.coverage_score}/100
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${reviewData.coverage_score}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #3b82f6, #2f9e44)',
                            }}
                          />
                        </div>
                        {reviewData.summary && (
                          <div style={{ fontSize: '0.84rem', color: '#334155', marginTop: '10px', lineHeight: 1.5 }}>
                            {reviewData.summary}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Strengths */}
                    {reviewData.strengths && reviewData.strengths.length > 0 && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d', marginBottom: '8px' }}>
                          ✓ Strengths Identified:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#166534', lineHeight: 1.6 }}>
                          {reviewData.strengths.map((str, i) => (
                            <li key={i}>{str}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Concerns */}
                    {reviewData.concerns && reviewData.concerns.length > 0 && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b45309', marginBottom: '8px' }}>
                          ⚠ Potential Pitfalls & Gaps:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6 }}>
                          {reviewData.concerns.map((con, i) => (
                            <li key={i}>{con}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Cases */}
                    {reviewData.suggested_test_cases && reviewData.suggested_test_cases.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7e22ce', marginBottom: '8px' }}>
                          Suggested Additional Cases:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {reviewData.suggested_test_cases.map((sug, i) => (
                            <div
                              key={i}
                              style={{
                                background: '#faf5ff',
                                border: '1px solid #e9d5ff',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontSize: '0.78rem',
                              }}
                            >
                              <div style={{ fontWeight: 600, color: '#581c87', marginBottom: '4px' }}>
                                {sug.reason}
                              </div>
                              <div style={{ fontFamily: 'monospace', color: '#64748b' }}>
                                in: <span style={{ color: '#0f172a' }}>{sug.input.trim()}</span> | exp:{' '}
                                <span style={{ color: '#2b8a3e', fontWeight: 600 }}>{sug.expected_output.trim()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* RIGHT PANE: C Code Editor (Light Mode) & Interactive Runner */}
        {/* ==================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
          {/* Editor Header */}
          <div
            style={{
              height: '40px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code2 size={16} color="#2f9e44" />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                solution.c
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: '#475569',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                C (gcc 13.2)
              </span>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              <span>{code.split('\n').length} lines</span>
            </div>
          </div>

          {/* Code Textarea with line numbers gutter */}
          <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
            {/* Line Numbers Gutter */}
            <div
              style={{
                width: '44px',
                padding: '16px 8px',
                background: '#f8fafc',
                borderRight: '1px solid #e2e8f0',
                userSelect: 'none',
                textAlign: 'right',
                color: '#94a3b8',
                fontFamily: 'Consolas, "Fira Code", monospace',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                overflow: 'hidden',
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>

            {/* Editable Code Box */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              style={{
                flex: 1,
                height: '100%',
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                outline: 'none',
                padding: '16px',
                fontFamily: 'Consolas, "Fira Code", monospace',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                resize: 'none',
                tabSize: 4,
                caretColor: '#2f9e44',
              }}
            />
          </div>

          {/* ================================================================ */}
          {/* BOTTOM CONSOLE / GFG RUNNER DRAWER */}
          {/* ================================================================ */}
          <div
            style={{
              height: '260px',
              borderTop: '2px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Console Drawer Tabs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 14px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                height: '38px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  onClick={() => setActiveConsoleTab('testcase')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: activeConsoleTab === 'testcase' ? '#2f9e44' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '8px 4px',
                    borderBottom: activeConsoleTab === 'testcase' ? '2px solid #2f9e44' : 'none',
                  }}
                >
                  Testcase
                </button>
                <button
                  onClick={() => setActiveConsoleTab('result')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: activeConsoleTab === 'result' ? '#2f9e44' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '8px 4px',
                    borderBottom: activeConsoleTab === 'result' ? '2px solid #2f9e44' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span>Test Result</span>
                  {runResponse && (
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background:
                          runResponse.verdict === 'Accepted'
                            ? '#2f9e44'
                            : runResponse.verdict === 'Wrong Answer'
                            ? '#ef4444'
                            : '#f59e0b',
                      }}
                    />
                  )}
                </button>
              </div>

              {runResponse && runResponse.total_execution_time_ms !== undefined && (
                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  <span>{runResponse.total_execution_time_ms} ms</span>
                </div>
              )}
            </div>

            {/* Console Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              {/* TAB A: Testcase Selector */}
              {activeConsoleTab === 'testcase' && (
                <div>
                  {/* Case Pills (First 8 + Custom) */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {testCases.slice(0, 8).map((tc, idx) => {
                      const isSelected = !isCustomMode && selectedCaseIndex === idx;
                      return (
                        <button
                          key={tc.test_id}
                          onClick={() => {
                            setSelectedCaseIndex(idx);
                            setIsCustomMode(false);
                          }}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: isSelected ? '#2f9e44' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#475569',
                            border: isSelected ? '1px solid #2f9e44' : '1px solid #cbd5e1',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Case {idx + 1}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setIsCustomMode(true)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: isCustomMode ? '#2f9e44' : '#ffffff',
                        color: isCustomMode ? '#ffffff' : '#475569',
                        border: isCustomMode ? '1px solid #2f9e44' : '1px solid #cbd5e1',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + Custom Input
                    </button>
                  </div>

                  {/* Input / Expected preview */}
                  {isCustomMode ? (
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Custom Standard Input:
                      </label>
                      <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          color: '#0f172a',
                          fontFamily: 'Consolas, monospace',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                        }}
                        placeholder="Enter stdin input..."
                      />
                    </div>
                  ) : activeTestCase ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                          Standard Input (stdin):
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px 10px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            color: '#0f172a',
                            fontFamily: 'Consolas, monospace',
                            fontSize: '0.82rem',
                          }}
                        >
                          {activeTestCase.input}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                          Expected Output:
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px 10px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '6px',
                            color: '#15803d',
                            fontFamily: 'Consolas, monospace',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          {activeTestCase.expected_output}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB B: Execution Result */}
              {activeConsoleTab === 'result' && (
                <div>
                  {isRunning ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '140px',
                        gap: '10px',
                        color: '#2f9e44',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                      }}
                    >
                      <Zap className="animate-spin" size={20} color="#2f9e44" />
                      <span>Compiling and executing C solution via GCC...</span>
                    </div>
                  ) : !runResponse ? (
                    <div style={{ color: '#64748b', fontSize: '0.84rem', textAlign: 'center', padding: '36px 0' }}>
                      Click <strong>Compile & Run</strong> or <strong>Submit ({testCases.length})</strong> to test your C solution.
                    </div>
                  ) : (
                    <div>
                      {/* GFG Signature Verdict Banner */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          marginBottom: '14px',
                          background:
                            runResponse.verdict === 'Accepted'
                              ? '#ecfdf5'
                              : runResponse.verdict === 'Wrong Answer'
                              ? '#fef2f2'
                              : '#fffbeb',
                          border: `1px solid ${
                            runResponse.verdict === 'Accepted'
                              ? '#a7f3d0'
                              : runResponse.verdict === 'Wrong Answer'
                              ? '#fecaca'
                              : '#fde68a'
                          }`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {runResponse.verdict === 'Accepted' ? (
                            <CheckCircle2 size={22} color="#10b981" />
                          ) : (
                            <XCircle size={22} color="#ef4444" />
                          )}
                          <div>
                            <div
                              style={{
                                fontSize: '1.05rem',
                                fontWeight: 800,
                                color:
                                  runResponse.verdict === 'Accepted'
                                    ? '#065f46'
                                    : runResponse.verdict === 'Wrong Answer'
                                    ? '#991b1b'
                                    : '#92400e',
                              }}
                            >
                              {runResponse.verdict === 'Accepted'
                                ? 'Correct Answer.'
                                : runResponse.verdict === 'Wrong Answer'
                                ? 'Wrong Answer.'
                                : runResponse.verdict}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                              {runResponse.verdict === 'Accepted'
                                ? 'Your program ran successfully against all test cases.'
                                : 'Output did not match expected solution for one or more test cases.'}
                            </div>
                          </div>
                        </div>

                        {runResponse.total_test_cases !== undefined && (
                          <span
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              color: runResponse.verdict === 'Accepted' ? '#065f46' : '#991b1b',
                              background: '#ffffff',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${
                                runResponse.verdict === 'Accepted' ? '#a7f3d0' : '#fecaca'
                              }`,
                            }}
                          >
                            {runResponse.passed_test_cases} / {runResponse.total_test_cases} Cases Passed
                          </span>
                        )}
                      </div>

                      {/* Compilation Errors if any */}
                      {runResponse.compilation_output && runResponse.verdict === 'Compilation Error' && (
                        <pre
                          style={{
                            margin: 0,
                            padding: '12px',
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '6px',
                            color: '#92400e',
                            fontSize: '0.82rem',
                            fontFamily: 'Consolas, monospace',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {runResponse.compilation_output}
                        </pre>
                      )}

                      {/* Single Mode Output */}
                      {runResponse.mode === 'single' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>
                              Your Output (stdout):
                            </div>
                            <pre
                              style={{
                                margin: 0,
                                padding: '8px 10px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                color: '#0f172a',
                                fontSize: '0.82rem',
                                fontFamily: 'Consolas, monospace',
                              }}
                            >
                              {runResponse.stdout || '(no output)'}
                            </pre>
                          </div>
                          {runResponse.stderr && (
                            <div>
                              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#dc2626', marginBottom: '3px' }}>
                                stderr:
                              </div>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: '8px 10px',
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  color: '#dc2626',
                                  fontSize: '0.82rem',
                                  fontFamily: 'Consolas, monospace',
                                }}
                              >
                                {runResponse.stderr}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Batch Mode Results View with Filter */}
                      {runResponse.mode === 'batch' && runResponse.results && (() => {
                        const failedCases = runResponse.results.filter((r) => !r.passed);
                        const passedCases = runResponse.results.filter((r) => r.passed);
                        const displayedResults = runResponse.results.filter((r) => {
                          if (resultFilter === 'failed') return !r.passed;
                          if (resultFilter === 'passed') return r.passed;
                          return true;
                        });

                        return (
                          <div>
                            {/* Filter Bar */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '12px',
                                paddingBottom: '8px',
                                borderBottom: '1px solid #e2e8f0',
                              }}
                            >
                              <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                                Filter Cases:
                              </span>
                              <button
                                onClick={() => setResultFilter('all')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  background: resultFilter === 'all' ? '#2f9e44' : '#ffffff',
                                  color: resultFilter === 'all' ? '#ffffff' : '#475569',
                                  border: resultFilter === 'all' ? '1px solid #2f9e44' : '1px solid #cbd5e1',
                                }}
                              >
                                All ({runResponse.results.length})
                              </button>
                              <button
                                onClick={() => setResultFilter('failed')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: resultFilter === 'failed' ? '#ef4444' : '#fef2f2',
                                  color: resultFilter === 'failed' ? '#ffffff' : '#991b1b',
                                  border: resultFilter === 'failed' ? '1px solid #ef4444' : '1px solid #fecaca',
                                }}
                              >
                                <XCircle size={13} />
                                <span>Failed ({failedCases.length})</span>
                              </button>
                              <button
                                onClick={() => setResultFilter('passed')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: resultFilter === 'passed' ? '#2f9e44' : '#ecfdf5',
                                  color: resultFilter === 'passed' ? '#ffffff' : '#065f46',
                                  border: resultFilter === 'passed' ? '1px solid #2f9e44' : '1px solid #a7f3d0',
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>Passed ({passedCases.length})</span>
                              </button>
                            </div>

                            {/* Cases List */}
                            {displayedResults.length === 0 ? (
                              <div style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', padding: '20px' }}>
                                No cases match the selected filter.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {displayedResults.map((r) => {
                                  const isFailed = !r.passed;
                                  return (
                                    <div
                                      key={r.test_case_number}
                                      style={{
                                        background: '#ffffff',
                                        border: `1px solid ${isFailed ? '#fecaca' : '#e2e8f0'}`,
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                      }}
                                    >
                                      {/* Header */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '7px 12px',
                                          background: isFailed ? '#fef2f2' : '#f8fafc',
                                          borderBottom: `1px solid ${isFailed ? '#fecaca' : '#e2e8f0'}`,
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          {isFailed ? (
                                            <XCircle size={15} color="#ef4444" />
                                          ) : (
                                            <CheckCircle2 size={15} color="#2f9e44" />
                                          )}
                                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                                            Case {r.test_case_number} {r.test_id ? `(${r.test_id})` : ''}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: '0.68rem',
                                              fontWeight: 700,
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              background: isFailed ? '#fee2e2' : '#dcfce7',
                                              color: isFailed ? '#b91c1c' : '#15803d',
                                              border: `1px solid ${isFailed ? '#fca5a5' : '#86efac'}`,
                                            }}
                                          >
                                            {r.passed
                                              ? 'Passed'
                                              : r.status === 'time_limit_exceeded'
                                              ? 'Time Limit Exceeded'
                                              : r.status === 'runtime_error'
                                              ? 'Runtime Error'
                                              : 'Wrong Answer'}
                                          </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          {r.execution_time_ms !== undefined && (
                                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                              {r.execution_time_ms} ms
                                            </span>
                                          )}
                                          <button
                                            onClick={() => {
                                              setCustomInput(r.input);
                                              setIsCustomMode(true);
                                              setActiveConsoleTab('testcase');
                                            }}
                                            style={{
                                              padding: '3px 8px',
                                              fontSize: '0.68rem',
                                              fontWeight: 600,
                                              borderRadius: '4px',
                                              background: '#ffffff',
                                              border: '1px solid #cbd5e1',
                                              color: '#2f9e44',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Load in Runner
                                          </button>
                                        </div>
                                      </div>

                                      {/* Card Details */}
                                      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Input */}
                                        <div>
                                          <div
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              marginBottom: '3px',
                                            }}
                                          >
                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                              Standard Input (stdin):
                                            </span>
                                            <button
                                              onClick={() => {
                                                navigator.clipboard.writeText(r.input);
                                                setCopiedInputIdx(r.test_case_number);
                                                setTimeout(() => setCopiedInputIdx(null), 1500);
                                              }}
                                              style={{
                                                background: 'none',
                                                border: 'none',
                                                color: copiedInputIdx === r.test_case_number ? '#15803d' : '#64748b',
                                                cursor: 'pointer',
                                                fontSize: '0.68rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                              }}
                                            >
                                              {copiedInputIdx === r.test_case_number ? <Check size={11} /> : <Copy size={11} />}
                                              <span>{copiedInputIdx === r.test_case_number ? 'Copied' : 'Copy'}</span>
                                            </button>
                                          </div>
                                          <pre
                                            style={{
                                              margin: 0,
                                              padding: '6px 8px',
                                              background: '#f8fafc',
                                              borderRadius: '4px',
                                              border: '1px solid #e2e8f0',
                                              color: '#0f172a',
                                              fontSize: '0.78rem',
                                              fontFamily: 'Consolas, monospace',
                                              whiteSpace: 'pre-wrap',
                                              maxHeight: '90px',
                                              overflowY: 'auto',
                                            }}
                                          >
                                            {r.input}
                                          </pre>
                                        </div>

                                        {/* Expected vs Actual Diff */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                          <div>
                                            <span
                                              style={{
                                                fontSize: '0.72rem',
                                                color: '#15803d',
                                                fontWeight: 600,
                                                display: 'block',
                                                marginBottom: '3px',
                                              }}
                                            >
                                              Expected Output:
                                            </span>
                                            <pre
                                              style={{
                                                margin: 0,
                                                padding: '6px 8px',
                                                background: '#f0fdf4',
                                                border: '1px solid #bbf7d0',
                                                borderRadius: '4px',
                                                color: '#15803d',
                                                fontSize: '0.78rem',
                                                fontFamily: 'Consolas, monospace',
                                                whiteSpace: 'pre-wrap',
                                                fontWeight: 600,
                                                maxHeight: '90px',
                                                overflowY: 'auto',
                                              }}
                                            >
                                              {r.expected_output !== undefined ? r.expected_output : '(none)'}
                                            </pre>
                                          </div>
                                          <div>
                                            <span
                                              style={{
                                                fontSize: '0.72rem',
                                                color: r.passed ? '#15803d' : '#b91c1c',
                                                fontWeight: 600,
                                                display: 'block',
                                                marginBottom: '3px',
                                              }}
                                            >
                                              Your Output (stdout):
                                            </span>
                                            <pre
                                              style={{
                                                margin: 0,
                                                padding: '6px 8px',
                                                background: r.passed ? '#f0fdf4' : '#fef2f2',
                                                border: `1px solid ${r.passed ? '#bbf7d0' : '#fecaca'}`,
                                                borderRadius: '4px',
                                                color: r.passed ? '#15803d' : '#b91c1c',
                                                fontSize: '0.78rem',
                                                fontFamily: 'Consolas, monospace',
                                                whiteSpace: 'pre-wrap',
                                                fontWeight: 600,
                                                maxHeight: '90px',
                                                overflowY: 'auto',
                                              }}
                                            >
                                              {r.actual_output || '(no output)'}
                                            </pre>
                                          </div>
                                        </div>

                                        {/* Stderr if present */}
                                        {r.stderr && (
                                          <div>
                                            <span
                                              style={{
                                                fontSize: '0.7rem',
                                                color: '#b91c1c',
                                                fontWeight: 600,
                                                display: 'block',
                                                marginBottom: '3px',
                                              }}
                                            >
                                              Diagnostics / Error:
                                            </span>
                                            <pre
                                              style={{
                                                margin: 0,
                                                padding: '6px 8px',
                                                background: '#fef2f2',
                                                border: '1px solid #fecaca',
                                                borderRadius: '4px',
                                                color: '#b91c1c',
                                                fontSize: '0.74rem',
                                                fontFamily: 'Consolas, monospace',
                                                whiteSpace: 'pre-wrap',
                                              }}
                                            >
                                              {r.stderr}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
