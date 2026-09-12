import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Upload,
  Play,
  Users,
  BarChart3,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sparkles,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Code2,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  EvaluationJob,
  ProblemInPack,
  ProblemModel,
  StudentSummaryItem,
  TestCaseItem,
  Week,
  WeekAnalytics,
  ZipValidationReport,
} from '../types';
import {
  deleteSingleProblem,
  deleteWeek,
  deleteWeekProblems,
  deployProblemPackToWeek,
  fetchEvaluationProgress,
  fetchSampleProblemJson,
  fetchSampleProblemPack,
  fetchWeek,
  fetchWeekAnalytics,
  fetchWeekProblems,
  fetchWeekStudents,
  getExportProblemPackUrl,
  getExportStudentJsonUrl,
  getExportWeekJsonUrl,
  getExportWeekZipUrl,
  startEvaluation,
  validateProblemPackJson,
  validateSubmissionZip,
} from '../services/api';
import { ProblemDetailModal } from '../components/ProblemDetailModal';
import { StudentDetailModal } from '../components/StudentDetailModal';
import { GeneratePackModal } from '../components/GeneratePackModal';
import { LeetCodeProblemView } from '../components/LeetCodeProblemView';
import { VerdictDonutChart, ProblemPassRateChart } from '../components/Charts';
import { StatCard } from '../components/StatCard';

interface Props {
  weekId: string;
  onBack: () => void;
  onDeleteWeek?: (weekId: string) => void;
}

const CLASS_SECTIONS = [
  'Section A',
  'Section B',
  'Section C',
  'Section D',
  'Section E',
  'Section F',
];

export const WeekDetailView: React.FC<Props> = ({ weekId, onBack, onDeleteWeek }) => {
  const [week, setWeek] = useState<Week | null>(null);
  const [activeTab, setActiveTab] = useState<'problems' | 'upload' | 'progress' | 'students' | 'analytics'>('problems');

  // Problems state
  const [problems, setProblems] = useState<ProblemInPack[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<ProblemInPack | null>(null);
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);

  // LeetCode Problem Testing state
  const [activeLeetCodeProblem, setActiveLeetCodeProblem] = useState<ProblemModel | null>(null);

  // JSON Import & Download Modal state
  const [isAddJsonModalOpen, setIsAddJsonModalOpen] = useState(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [jsonMode, setJsonMode] = useState<'single' | 'multi'>('multi');
  const [jsonText, setJsonText] = useState('');
  const [jsonValidationResult, setJsonValidationResult] = useState<{
    valid: boolean | null;
    message: string | null;
    previewCount?: number;
  }>({ valid: null, message: null });
  const [isValidatingJson, setIsValidatingJson] = useState(false);
  const [importReplaceAll, setImportReplaceAll] = useState(false);

  // Helper to convert ProblemInPack to ProblemModel for LeetCodeProblemView
  const problemInPackToProblemModel = (p: ProblemInPack): ProblemModel => {
    const pubCases = p.public_test_cases || [];
    const hidCases = p.hidden_test_cases || [];
    const testCases: TestCaseItem[] = [
      ...pubCases.map((tc, idx) => ({
        test_id: `P${p.number}-Pub-${idx + 1}`,
        category: 'base' as const,
        input: tc.input,
        expected_output: tc.expected_output,
        reason: 'Public test case',
        severity: 'normal' as const,
        validation_status: 'passed' as const,
      })),
      ...hidCases.map((tc, idx) => ({
        test_id: `P${p.number}-Hid-${idx + 1}`,
        category: 'edge' as const,
        input: tc.input,
        expected_output: tc.expected_output,
        reason: 'Hidden edge case',
        severity: 'critical' as const,
        validation_status: 'passed' as const,
      })),
    ];
    return {
      problem_id: `P${p.number}`,
      title: p.title,
      statement: p.description,
      requirements: p.hints || [],
      concepts: p.topics || [],
      constraints: p.constraints || [],
      classification: {
        category: p.topics?.[0] || 'general',
        difficulty: p.difficulty || 'Easy',
        required_constructs: [],
      },
      test_strategy: {
        base_cases: pubCases.length,
        boundary_cases: 2,
        edge_cases: hidCases.length,
        failing_cases: 0,
        special_cases: 1,
        invalid_input_cases: 0,
        stress_cases: 2,
        metamorphic_cases: 0,
      },
      reference_solution_c: p.reference_solution_c || '',
      division_approved: true,
      test_cases: testCases,
    };
  };

  const handleValidateJsonInput = async (content: string) => {
    setJsonText(content);
    if (!content.trim()) {
      setJsonValidationResult({ valid: null, message: null });
      return;
    }
    setIsValidatingJson(true);
    try {
      const parsed = JSON.parse(content);
      const valRes = await validateProblemPackJson(parsed);
      if (valRes.valid && valRes.pack) {
        const count = valRes.pack.problems.length;
        setJsonValidationResult({
          valid: true,
          message: count === 1
            ? `✓ Valid Single Problem: "${valRes.pack.problems[0].title || valRes.pack.problems[0].problem_id}"`
            : `✓ Valid Problem Pack: "${valRes.pack.title}" (${count} problems)`,
          previewCount: count,
        });
      } else {
        setJsonValidationResult({ valid: false, message: valRes.error || 'Validation failed' });
      }
    } catch (err: any) {
      setJsonValidationResult({ valid: false, message: `JSON syntax error: ${err.message}` });
    } finally {
      setIsValidatingJson(false);
    }
  };

  const handleApplyJsonImport = async () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText);
      const valRes = await validateProblemPackJson(parsed);
      if (valRes.valid && valRes.pack) {
        await deployProblemPackToWeek(weekId, valRes.pack, importReplaceAll);
        setIsAddJsonModalOpen(false);
        setJsonText('');
        setJsonValidationResult({ valid: null, message: null });
        reloadWeekData();
      } else {
        alert(`Cannot import: ${valRes.error}`);
      }
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    }
  };

  const handleDownloadSample = async (type: 'single' | 'multi') => {
    try {
      setIsDownloadDropdownOpen(false);
      const sample = type === 'single' ? await fetchSampleProblemJson() : await fetchSampleProblemPack();
      const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'single' ? 'sample_single_problem.json' : 'sample_problem_pack.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to download sample: ${err.message}`);
    }
  };

  const handleLoadSampleToModal = async (type: 'single' | 'multi') => {
    try {
      const sample = type === 'single' ? await fetchSampleProblemJson() : await fetchSampleProblemPack();
      setJsonMode(type);
      handleValidateJsonInput(JSON.stringify(sample, null, 2));
    } catch (err: any) {
      alert(`Failed to load sample: ${err.message}`);
    }
  };

  // Class Section state for ZIP Upload
  const [targetSection, setTargetSection] = useState('Section A');
  const [customSection, setCustomSection] = useState('');
  const [isCustomSection, setIsCustomSection] = useState(false);
  const activeSection = isCustomSection && customSection.trim() ? customSection.trim() : targetSection;

  // Upload & Validation state
  const [validationReport, setValidationReport] = useState<ZipValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [continueOnError, setContinueOnError] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Evaluation state
  const [currentJob, setCurrentJob] = useState<EvaluationJob | null>(null);
  const [startingEval, setStartingEval] = useState(false);

  // Students state
  const [students, setStudents] = useState<StudentSummaryItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchStudent, setSearchStudent] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'perfect' | 'has_ce' | 'has_wa' | 'missing'>('all');
  const [studentSectionFilter, setStudentSectionFilter] = useState<'all' | string>('all');

  // Analytics state
  const [analytics, setAnalytics] = useState<WeekAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsSectionFilter, setAnalyticsSectionFilter] = useState<'all' | string>('all');

  // Load initial week data
  const reloadWeekData = () => {
    fetchWeek(weekId).then(setWeek).catch(console.error);
    fetchWeekProblems(weekId).then(setProblems).catch(console.error);
    fetchWeekStudents(weekId).then(setStudents).catch(console.error);
  };

  useEffect(() => {
    reloadWeekData();
  }, [weekId]);

  // Load analytics when analytics tab opens or section filter changes
  useEffect(() => {
    if (activeTab === 'analytics') {
      setLoadingAnalytics(true);
      fetchWeekAnalytics(weekId, analyticsSectionFilter !== 'all' ? analyticsSectionFilter : undefined)
        .then((data) => {
          setAnalytics(data);
          setLoadingAnalytics(false);
        })
        .catch((err) => {
          console.error(err);
          setLoadingAnalytics(false);
        });
    }
  }, [activeTab, weekId, analyticsSectionFilter]);

  // Poll evaluation progress if job is active
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') {
      return;
    }

    const interval = setInterval(() => {
      fetchEvaluationProgress(currentJob.job_id)
        .then((job) => {
          setCurrentJob(job);
          if (job.status === 'completed') {
            reloadWeekData();
          }
        })
        .catch(console.error);
    }, 1500);

    return () => clearInterval(interval);
  }, [currentJob, weekId]);

  // Handle ZIP file selection & safe validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidating(true);
    setValidationError('');
    setValidationReport(null);

    try {
      const report = await validateSubmissionZip(weekId, file, activeSection);
      setValidationReport(report);
    } catch (err: any) {
      setValidationError(err.message || 'ZIP validation failed.');
    } finally {
      setValidating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Launch evaluation job
  const handleProceedEvaluation = async () => {
    if (!validationReport) return;
    setStartingEval(true);
    try {
      const job = await startEvaluation(
        weekId,
        validationReport.staging_token,
        continueOnError,
        validationReport.section || activeSection
      );
      setCurrentJob(job);
      setActiveTab('progress');
    } catch (err: any) {
      alert(err.message || 'Failed to start evaluation job.');
    } finally {
      setStartingEval(false);
    }
  };

  const handleDeleteWeek = async () => {
    if (!week) return;
    if (
      !window.confirm(
        `Are you sure you want to delete Week ${week.week_number} ("${week.title}") and all associated problems, student records, and evaluation submissions?\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteWeek(week.id);
      if (onDeleteWeek) {
        onDeleteWeek(week.id);
      } else {
        onBack();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete week.');
    }
  };

  const handleDeleteProblemPack = async () => {
    if (!week) return;
    if (!window.confirm(`Are you sure you want to delete all ${problems.length} problems from Week ${week.week_number}? This will reset the problem pack.`)) {
      return;
    }
    try {
      await deleteWeekProblems(week.id);
      setProblems([]);
      await reloadWeekData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete problem pack.');
    }
  };

  const handleDeleteSingleProblem = async (problemNumber: number) => {
    if (!week) return;
    if (!window.confirm(`Are you sure you want to delete problem P${problemNumber}?`)) {
      return;
    }
    try {
      await deleteSingleProblem(week.id, problemNumber);
      const updated = await fetchWeekProblems(week.id);
      setProblems(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to delete problem.');
    }
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.student_id.toLowerCase().includes(searchStudent.toLowerCase());
    if (!matchesSearch) return false;

    if (studentSectionFilter !== 'all' && (s.section || 'Section A') !== studentSectionFilter) {
      return false;
    }

    if (studentFilter === 'perfect') return s.solved_count >= 10;
    if (studentFilter === 'has_ce') return s.compilation_errors > 0;
    if (studentFilter === 'has_wa') return s.wrong_answers > 0;
    if (studentFilter === 'missing') return s.not_submitted > 0;
    return true;
  });

  if (!week) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading week details...</div>;
  }

  return (
    <div>
      {/* Top Navigation & Hub Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={onBack}
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: '14px', gap: '6px' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Dashboard</span>
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'white',
            padding: '24px 28px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                Week {week.week_number}
              </span>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {week.title}
              </h2>
              <span
                style={{
                  textTransform: 'uppercase',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  backgroundColor:
                    week.status === 'evaluated'
                      ? '#ecfdf5'
                      : week.status === 'evaluating'
                      ? '#eff6ff'
                      : '#f8fafc',
                  color:
                    week.status === 'evaluated'
                      ? '#065f46'
                      : week.status === 'evaluating'
                      ? '#1d4ed8'
                      : '#475569',
                  border: '1px solid currentColor',
                }}
              >
                {week.status}
              </span>
            </div>
            {week.description && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {week.description}
              </p>
            )}
          </div>

          {/* Quick Export Downloads */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href={getExportWeekJsonUrl(week.id)}
              download={`week_${String(week.week_number).padStart(2, '0')}_results.json`}
              className="btn btn-secondary btn-sm"
              title="Download consolidated JSON of entire week results"
            >
              <Download size={14} />
              <span>Week JSON</span>
            </a>
            <a
              href={getExportWeekZipUrl(week.id)}
              download={`week_${String(week.week_number).padStart(2, '0')}_results.zip`}
              className="btn btn-secondary btn-sm"
              title="Download ZIP with all students and problem results"
            >
              <Download size={14} />
              <span>Week ZIP</span>
            </a>
            <button
              onClick={handleDeleteWeek}
              className="btn btn-secondary btn-sm"
              style={{
                backgroundColor: '#fff1f2',
                color: '#e11d48',
                borderColor: '#fecdd3',
                gap: '5px',
              }}
              title="Delete this week and all associated data"
            >
              <Trash2 size={14} />
              <span>Delete Week</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tab-nav">
        <button
          onClick={() => setActiveTab('problems')}
          className={`tab-btn ${activeTab === 'problems' ? 'active' : ''}`}
        >
          <BookOpen size={16} />
          <span>Problem Pack ({problems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
        >
          <Upload size={16} />
          <span>Upload & Validate ZIP</span>
        </button>

        {currentJob && (
          <button
            onClick={() => setActiveTab('progress')}
            className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
          >
            <Play size={16} />
            <span>Evaluation Progress ({currentJob.progress_percentage.toFixed(0)}%)</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('students')}
          className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>Students Directory ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          <BarChart3 size={16} />
          <span>Analytics & Reports</span>
        </button>
      </div>

      {/* TAB 1: PROBLEM PACK */}
      {activeTab === 'problems' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 className="card-title">Laboratory Problem Pack (Week {week.week_number})</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                C programming laboratory problems with verified reference solutions, test cases, and GCC runner
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Add / Import JSON Button */}
              <button
                onClick={() => {
                  setJsonMode('multi');
                  setIsAddJsonModalOpen(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
              >
                <Upload size={14} />
                <span>Add / Import JSON</span>
              </button>

              {/* Download Sample JSON Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Download size={14} />
                  <span>Sample JSON</span>
                  <ChevronDown size={13} />
                </button>

                {isDownloadDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '6px',
                      background: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      zIndex: 100,
                      width: '240px',
                      padding: '6px',
                    }}
                  >
                    <button
                      onClick={() => handleDownloadSample('multi')}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <strong style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>Multi-Problem Pack (Sample)</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Complete curriculum pack JSON
                      </span>
                    </button>

                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                    <button
                      onClick={() => handleDownloadSample('single')}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <strong style={{ fontSize: '0.82rem', color: '#10b981' }}>Single Problem (Sample)</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Standalone single problem JSON
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Setup / Add Questions */}
              <button onClick={() => setIsPackModalOpen(true)} className="btn btn-primary btn-sm">
                <Sparkles size={14} />
                <span>+ Add Questions / Setup</span>
              </button>

              {problems.length > 0 && (
                <>
                  <a
                    href={getExportProblemPackUrl(week.id)}
                    download={`Week_${String(week.week_number).padStart(2, '0')}_Problems.zip`}
                    className="btn btn-secondary btn-sm"
                  >
                    <Download size={14} />
                    <span>Export ZIP</span>
                  </a>
                  <button
                    onClick={handleDeleteProblemPack}
                    className="btn btn-secondary btn-sm"
                    style={{
                      backgroundColor: '#fff1f2',
                      color: '#e11d48',
                      borderColor: '#fecdd3',
                      gap: '5px',
                    }}
                    title="Delete all problems in this pack"
                  >
                    <Trash2 size={14} />
                    <span>Delete Pack</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {problems.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <BookOpen size={40} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                No problems configured for Week {week.week_number} yet
              </h4>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Add your exact laboratory questions, seed standard problems, or generate using AI.
              </p>
              <button onClick={() => setIsPackModalOpen(true)} className="btn btn-primary">
                <Sparkles size={16} />
                <span>Setup Problem Pack / Add Questions</span>
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>#</th>
                    <th>Problem Title</th>
                    <th style={{ width: '120px' }}>Difficulty</th>
                    <th>Topics</th>
                    <th style={{ width: '130px' }}>Test Cases</th>
                    <th style={{ width: '140px' }}>Reference</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>P{p.number}</td>
                      <td
                        style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}
                        onClick={() => setActiveLeetCodeProblem(problemInPackToProblemModel(p))}
                        title="Click to open Code Workspace"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{p.title}</span>
                          <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Code2 size={12} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: p.difficulty === 'Easy' ? '#ecfdf5' : '#fffbeb',
                            color: p.difficulty === 'Easy' ? '#065f46' : '#92400e',
                            border: '1px solid currentColor',
                          }}
                        >
                          {p.difficulty}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {p.topics.map((t, idx) => (
                            <span
                              key={idx}
                              style={{
                                backgroundColor: 'var(--bg-subtle)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.72rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{p.public_test_cases.length}</span> public,{' '}
                        <span style={{ fontWeight: 600 }}>{p.hidden_test_cases.length}</span> hidden
                      </td>
                      <td>
                        {p.is_verified ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>
                            <CheckCircle2 size={14} /> Verified ✓
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#e11d48', fontSize: '0.8rem', fontWeight: 600 }}>
                            <AlertTriangle size={14} /> Unverified
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setActiveLeetCodeProblem(problemInPackToProblemModel(p))}
                            className="btn btn-primary btn-sm"
                            style={{
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: 'none',
                              color: '#ffffff',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                            }}
                            title="Open interactive Code Workspace to test with GCC"
                          >
                            <Code2 size={13} />
                            <span>View Code</span>
                          </button>
                          <button onClick={() => setSelectedProblem(p)} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}>
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSingleProblem(p.number)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: '#e11d48', borderColor: '#fecdd3' }}
                            title={`Delete Problem P${p.number}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPLOAD & VALIDATE ZIP */}
      {activeTab === 'upload' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Upload Student Submissions ZIP</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Upload an archive formatted as <code>student_id/p1.c ... p{problems.length || 'N'}.c</code> for safe inspection and missing file validation
              </p>
            </div>
          </div>

          {/* Section Selection for Class Batch Upload */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="var(--primary)" />
                  Target Class Section (1 of 6 sections)
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  The problem pack (P1..P{problems.length || 'N'}) is identical across all 6 class sections. Choose the section for this upload batch.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor: '#eff6ff',
                  color: 'var(--primary)',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  border: '1px solid #bfdbfe',
                }}
              >
                Uploading to: {activeSection}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {CLASS_SECTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setTargetSection(sec);
                    setIsCustomSection(false);
                  }}
                  className={`btn btn-sm ${!isCustomSection && targetSection === sec ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontWeight: 600 }}
                >
                  {sec}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomSection(!isCustomSection)}
                className={`btn btn-sm ${isCustomSection ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontWeight: 600 }}
              >
                Custom Section...
              </button>
              {isCustomSection && (
                <input
                  type="text"
                  placeholder="e.g. Section G or CSE-A"
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '0.84rem',
                    width: '180px',
                    backgroundColor: 'white',
                  }}
                />
              )}
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-subtle)',
              marginBottom: '24px',
            }}
          >
            <Upload size={38} color="var(--primary)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Select submissions ZIP for {activeSection}
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Files will be scanned safely with anti-traversal protection, tagged to {activeSection}, and validated against P1..P{problems.length || 'N'}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="zip-upload-input"
            />
            <label htmlFor="zip-upload-input" className={`btn btn-primary ${validating ? 'disabled' : ''}`}>
              <Upload size={16} />
              <span>{validating ? `Extracting & Validating ZIP for ${activeSection}...` : `Choose ZIP for ${activeSection}`}</span>
            </label>
          </div>

          {validationError && (
            <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.88rem' }}>
              {validationError}
            </div>
          )}

          {/* Validation Report Card */}
          {validationReport && (
            <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      ZIP Validation Summary
                    </h4>
                    <span
                      style={{
                        backgroundColor: '#eff6ff',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {validationReport.section || activeSection}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Archive: <code>{validationReport.zip_filename}</code>
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={continueOnError}
                      onChange={(e) => setContinueOnError(e.target.checked)}
                    />
                    <span>Continue evaluation on missing files</span>
                  </label>

                  <button
                    onClick={handleProceedEvaluation}
                    disabled={startingEval}
                    className="btn btn-primary"
                  >
                    <Play size={16} />
                    <span>{startingEval ? 'Starting...' : `Proceed Evaluation (${validationReport.section || activeSection})`}</span>
                  </button>
                </div>
              </div>

              {/* Summary Stats with Section info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>TARGET SECTION</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {validationReport.section || activeSection}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>STUDENTS DETECTED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{validationReport.total_students}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>PROGRAMS FOUND</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                    {validationReport.total_found_programs} / {validationReport.total_expected_programs}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>MISSING PROGRAMS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: validationReport.total_missing_programs > 0 ? '#dc2626' : '#059669' }}>
                    {validationReport.total_missing_programs}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>COMPLETION RATE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {validationReport.total_expected_programs > 0
                      ? ((validationReport.total_found_programs / validationReport.total_expected_programs) * 100).toFixed(1)
                      : 0}%
                  </div>
                </div>
              </div>

              {/* Student Breakdown Table */}
              <div className="table-container" style={{ maxHeight: '340px' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '140px' }}>Student ID</th>
                      <th style={{ width: '130px' }}>Files Found</th>
                      <th>Problem Checklist (P1 → P{validationReport.students[0]?.programs.length || problems.length || 'N'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationReport.students.map((st) => (
                      <tr key={st.student_id}>
                        <td style={{ fontWeight: 700 }}>{st.student_id}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: st.missing_count > 0 ? '#dc2626' : '#059669' }}>
                            {st.total_found} / {st.programs.length || problems.length || 10}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {st.programs.map((prog) => (
                              <span
                                key={prog.problem_number}
                                title={prog.found ? `P${prog.problem_number}: ${prog.filename}` : `P${prog.problem_number}: Missing`}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  backgroundColor: prog.found ? '#ecfdf5' : '#fee2e2',
                                  color: prog.found ? '#065f46' : '#991b1b',
                                  border: `1px solid ${prog.found ? '#a7f3d0' : '#fecaca'}`,
                                }}
                              >
                                {prog.problem_number}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE EVALUATION PROGRESS */}
      {activeTab === 'progress' && currentJob && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Batch Evaluation Progress</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Job ID: <code>{currentJob.job_id}</code> • Concurrency: Controlled Worker Pool
              </p>
            </div>
            <span
              style={{
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: currentJob.status === 'completed' ? '#ecfdf5' : '#eff6ff',
                color: currentJob.status === 'completed' ? '#065f46' : '#1d4ed8',
                border: '1px solid currentColor',
              }}
            >
              {currentJob.status}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
            {/* Animated Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Evaluating C programs...</span>
                <span>{currentJob.progress_percentage.toFixed(1)}%</span>
              </div>
              <div className="progress-container" style={{ height: '14px' }}>
                <div className="progress-fill" style={{ width: `${currentJob.progress_percentage}%` }} />
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PROGRAMS EVALUATED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                  {currentJob.processed_submissions} / {currentJob.total_submissions}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>STUDENTS PROCESSED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                  {currentJob.processed_students} / {currentJob.total_students}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CURRENT TICKER</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
                  {currentJob.current_student || 'Evaluating...'}
                </div>
              </div>
            </div>

            {currentJob.status === 'completed' && (
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#065f46', fontWeight: 600 }}>
                  <CheckCircle2 size={20} />
                  <span>Evaluation finished successfully! All submission records and compiler diagnostics stored in database.</span>
                </div>
                <button onClick={() => setActiveTab('students')} className="btn btn-primary btn-sm">
                  <span>View Student Results</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STUDENTS DIRECTORY */}
      {activeTab === 'students' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Evaluated Students Directory</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Search and inspect individual student test scores, compilation errors, and program sources across all 6 class sections
              </p>
            </div>
          </div>

          {/* Section Filter Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              flexWrap: 'wrap',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> Class Section:
            </span>
            <button
              onClick={() => setStudentSectionFilter('all')}
              className={`btn btn-sm ${studentSectionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            >
              All Sections ({students.length})
            </button>
            {CLASS_SECTIONS.map((sec) => {
              const secCount = students.filter((s) => (s.section || 'Section A') === sec).length;
              return (
                <button
                  key={sec}
                  onClick={() => setStudentSectionFilter(sec)}
                  className={`btn btn-sm ${studentSectionFilter === sec ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                >
                  {sec} {secCount > 0 ? `(${secCount})` : ''}
                </button>
              );
            })}
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search student ID..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.88rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['all', 'perfect', 'has_ce', 'has_wa', 'missing'] as const).map((filterVal) => (
                <button
                  key={filterVal}
                  onClick={() => setStudentFilter(filterVal)}
                  className={`btn btn-sm ${studentFilter === filterVal ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {filterVal === 'all' && 'All Statuses'}
                  {filterVal === 'perfect' && (problems.length > 0 ? `100% Solved (${problems.length}/${problems.length})` : '100% Solved')}
                  {filterVal === 'has_ce' && 'Has Compilation Error'}
                  {filterVal === 'has_wa' && 'Has Wrong Answer'}
                  {filterVal === 'missing' && 'Missing Files'}
                </button>
              ))}
            </div>
          </div>

          {/* Students Table */}
          {students.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Users size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                No students evaluated yet
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Upload a student submissions ZIP in the "Upload & Validate ZIP" tab to begin evaluating.
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No students match the selected filters.
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Student ID</th>
                    <th style={{ width: '110px' }}>Section</th>
                    <th style={{ width: '110px' }}>Solved</th>
                    <th style={{ width: '170px' }}>Pass Rate</th>
                    <th style={{ width: '80px' }}>CE</th>
                    <th style={{ width: '80px' }}>WA</th>
                    <th style={{ width: '110px' }}>Avg Time</th>
                    <th style={{ width: '200px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((st) => (
                    <tr key={st.student_id}>
                      <td style={{ fontWeight: 700 }}>{st.student_id}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          {st.section || 'Section A'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{st.solved_count}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / {problems.length || 10}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${st.acceptance_rate}%`,
                                height: '100%',
                                backgroundColor: st.acceptance_rate >= 80 ? '#10b981' : st.acceptance_rate >= 50 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, width: '38px' }}>
                            {st.acceptance_rate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: st.compilation_errors > 0 ? '#e11d48' : 'var(--text-muted)' }}>
                          {st.compilation_errors}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: st.wrong_answers > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                          {st.wrong_answers}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {st.average_time_ms > 0 ? `${st.average_time_ms.toFixed(1)} ms` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedStudentId(st.student_id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 10px' }}
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                          <a
                            href={getExportStudentJsonUrl(week.id, st.student_id)}
                            download={`student_${st.student_id}_week_${week.week_number}.json`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 8px' }}
                            title="Download student JSON"
                          >
                            <Download size={13} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ANALYTICS & REPORTS */}
      {activeTab === 'analytics' && (
        <div>
          {loadingAnalytics ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Computing week analytics...</div>
          ) : !analytics || analytics.total_programs === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <BarChart3 size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                No analytics available yet
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Cohort acceptance rates, verdict breakdowns, and problem statistics will appear here after student submissions are evaluated.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Analytics Section View Filter Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  backgroundColor: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} /> Analytics Filter:
                  </span>
                  <button
                    onClick={() => setAnalyticsSectionFilter('all')}
                    className={`btn btn-sm ${analyticsSectionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    All Sections (Combined)
                  </button>
                  {CLASS_SECTIONS.map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setAnalyticsSectionFilter(sec)}
                      className={`btn btn-sm ${analyticsSectionFilter === sec ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      {sec}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={getExportWeekJsonUrl(week.id, analyticsSectionFilter !== 'all' ? analyticsSectionFilter : undefined)}
                    download={`week_${String(week.week_number).padStart(2, '0')}${analyticsSectionFilter !== 'all' ? `_${analyticsSectionFilter.replace(' ', '_')}` : ''}_results.json`}
                    className="btn btn-secondary btn-sm"
                    title="Export JSON for current view"
                  >
                    <Download size={13} />
                    <span>{analyticsSectionFilter === 'all' ? 'All Cohort' : analyticsSectionFilter} JSON</span>
                  </a>
                  <a
                    href={getExportWeekZipUrl(week.id, analyticsSectionFilter !== 'all' ? analyticsSectionFilter : undefined)}
                    download={`week_${String(week.week_number).padStart(2, '0')}${analyticsSectionFilter !== 'all' ? `_${analyticsSectionFilter.replace(' ', '_')}` : ''}_results.zip`}
                    className="btn btn-secondary btn-sm"
                    title="Export ZIP for current view"
                  >
                    <Download size={13} />
                    <span>{analyticsSectionFilter === 'all' ? 'All Cohort' : analyticsSectionFilter} ZIP</span>
                  </a>
                </div>
              </div>
              {/* Top Overview Cards */}
              <div className="stats-grid">
                <StatCard
                  label="Acceptance Rate"
                  value={`${analytics.overall_acceptance_rate.toFixed(1)}%`}
                  description="Percent of all programs evaluated"
                  icon={<CheckCircle2 size={20} color="#10b981" />}
                />
                <StatCard
                  label="Total Evaluated"
                  value={analytics.total_programs}
                  description={`${analytics.total_students} students evaluated`}
                  icon={<Users size={20} color="var(--primary)" />}
                />
                <StatCard
                  label="Test Cases Passed"
                  value={`${analytics.avg_test_cases_passed_pct.toFixed(1)}%`}
                  description="Average test case pass percentage"
                  icon={<CheckCircle2 size={20} color="#06b6d4" />}
                />
                <StatCard
                  label="Avg Execution Time"
                  value={`${analytics.avg_execution_time_ms.toFixed(1)} ms`}
                  description="Average runtime per program"
                  icon={<BarChart3 size={20} color="#8b5cf6" />}
                />
              </div>

              {/* Two Column Layout: Donut Chart & Problem Pass Rates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '16px' }}>Verdict Distribution</h3>
                  <VerdictDonutChart verdicts={analytics.verdicts} total={analytics.total_programs} />
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '16px' }}>Problems by Acceptance Rate</h3>
                  <ProblemPassRateChart problems={analytics.problem_stats} />
                </div>
              </div>

              {/* Top and Struggling Students Lists */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '12px', color: '#065f46' }}>
                    Top Performing Students
                  </h3>
                  {analytics.top_students.length === 0 ? (
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>No top students identified yet.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {analytics.top_students.map((sid) => (
                        <button
                          key={sid}
                          onClick={() => setSelectedStudentId(sid)}
                          className="btn btn-secondary btn-sm"
                          style={{ backgroundColor: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
                        >
                          <span>{sid}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '12px', color: '#991b1b' }}>
                    Students Needing Attention
                  </h3>
                  {analytics.struggling_students.length === 0 ? (
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>No struggling students identified.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {analytics.struggling_students.map((sid) => (
                        <button
                          key={sid}
                          onClick={() => setSelectedStudentId(sid)}
                          className="btn btn-secondary btn-sm"
                          style={{ backgroundColor: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' }}
                        >
                          <span>{sid}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedProblem && (
        <ProblemDetailModal
          problem={selectedProblem}
          onClose={() => setSelectedProblem(null)}
        />
      )}

      {selectedStudentId && (
        <StudentDetailModal
          weekId={week.id}
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      )}

      {isPackModalOpen && (
        <GeneratePackModal
          weekId={week.id}
          weekNumber={week.week_number}
          isOpen={isPackModalOpen}
          onClose={() => setIsPackModalOpen(false)}
          onPackUpdated={(newProbs) => setProblems(newProbs)}
        />
      )}

      {/* LeetCode Style Problem Testing Workspace */}
      {activeLeetCodeProblem && (
        <LeetCodeProblemView
          problem={activeLeetCodeProblem}
          onClose={() => setActiveLeetCodeProblem(null)}
        />
      )}

      {/* Add / Import JSON Modal */}
      {isAddJsonModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setIsAddJsonModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '26px',
              background: 'white',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Import JSON Problem Data — Week {week.week_number}
                </h3>
              </div>
              <button
                onClick={() => setIsAddJsonModalOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Toggle: Single Problem vs Multi-Problem Pack */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                onClick={() => {
                  setJsonMode('single');
                  handleLoadSampleToModal('single');
                }}
                className="btn btn-sm"
                style={{
                  flex: 1,
                  background: jsonMode === 'single' ? 'var(--primary)' : 'var(--bg)',
                  color: jsonMode === 'single' ? '#ffffff' : 'var(--text-secondary)',
                  border: jsonMode === 'single' ? '1px solid var(--primary)' : '1px solid var(--border)',
                  fontWeight: 700,
                }}
              >
                Single Problem JSON
              </button>
              <button
                onClick={() => {
                  setJsonMode('multi');
                  handleLoadSampleToModal('multi');
                }}
                className="btn btn-sm"
                style={{
                  flex: 1,
                  background: jsonMode === 'multi' ? 'var(--primary)' : 'var(--bg)',
                  color: jsonMode === 'multi' ? '#ffffff' : 'var(--text-secondary)',
                  border: jsonMode === 'multi' ? '1px solid var(--primary)' : '1px solid var(--border)',
                  fontWeight: 700,
                }}
              >
                Multi-Problem Pack JSON
              </button>
            </div>

            {/* Quick Sample Insertion Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Paste JSON or drop a .json file:
              </label>
              <button
                onClick={() => handleLoadSampleToModal(jsonMode)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.74rem', padding: '2px 8px' }}
              >
                Load Starter Template
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => handleValidateJsonInput(e.target.value)}
              placeholder='Paste JSON here (supports {"statement": ...}, [{"statement": ...}], or full ProblemPack JSON)'
              rows={10}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: '1.4',
                resize: 'vertical',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                marginBottom: '12px',
              }}
            />

            {/* Validation Banner */}
            {jsonValidationResult.message && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.84rem',
                  marginBottom: '16px',
                  backgroundColor: jsonValidationResult.valid ? '#ecfdf5' : '#fef2f2',
                  color: jsonValidationResult.valid ? '#065f46' : '#991b1b',
                  border: `1px solid ${jsonValidationResult.valid ? '#a7f3d0' : '#fecaca'}`,
                  fontWeight: 600,
                }}
              >
                {jsonValidationResult.message}
              </div>
            )}

            {/* Replace / Append Checkbox */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', color: importReplaceAll ? '#dc2626' : 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={importReplaceAll}
                  onChange={(e) => setImportReplaceAll(e.target.checked)}
                />
                <span>Replace all existing problems in Week {week.week_number} (default: unchecked to append)</span>
              </label>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsAddJsonModalOpen(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyJsonImport}
                disabled={!jsonValidationResult.valid || isValidatingJson}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 700 }}
              >
                {importReplaceAll ? 'Replace & Import' : 'Append & Import to Week'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
