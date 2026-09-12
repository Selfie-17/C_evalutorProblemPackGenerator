import React, { useState, useEffect, useRef } from 'react';
import {
  FolderArchive,
  Download,
  Upload,
  FileCode,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  ChevronRight,
  Eye,
  Edit3,
  Check,
  Zap,
  Info,
  ShieldCheck,
  Code2,
  Sparkles,
  Layers,
  X,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import {
  ProblemModel,
  ProblemPackModel,
  Week,
} from '../types';
import {
  classifyProblemPack,
  deployProblemPackToWeek,
  fetchGeminiStatus,
  fetchSampleProblemPack,
  fetchSampleProblemJson,
  fetchWeeks,
  generateProblemTestCases,
  parseProblemText,
  validateProblemPackJson,
} from '../services/api';
import { ProblemDivisionModal } from '../components/ProblemDivisionModal';
import { LeetCodeProblemView } from '../components/LeetCodeProblemView';

const DEFAULT_13_QUESTIONS = `1. Write a C program to check whether a given number is even or odd.

2. Write a C program to determine whether a given number is positive, negative, or zero.

3. Write a C program to check whether an entered character is an uppercase letter, lowercase letter, digit, or special character.

4. Write a C program to check whether a given year is a leap year or not.

5. Write a C program to display the memory allocation required for different C data types using the \`sizeof()\` operator.

6. Write a menu-based C program to perform addition, subtraction, multiplication, division, modulus, and power using a \`switch\` statement.

7. Write a C program to swap two numbers without using a third/temporary variable.

8. Write a C program to swap two numbers using a temporary variable.

9. Write a C program to check whether a given number is a perfect square without using the \`sqrt()\` library function.

10. Write a C program to calculate a student's grade based on marks using \`if-else\` statements.

11. Write an extended menu-based C calculator that handles invalid menu choices and division by zero.

12. Write a C program to find the largest of three numbers using the ternary operator.

13. Write a C program to convert a grade point to a letter grade using a \`switch\` statement.
`;

export function ProblemPackView() {
  // Main Pack State
  const [pack, setPack] = useState<ProblemPackModel | null>(null);

  // Model & Generation Config
  const [modelProvider, setModelProvider] = useState<'qwen' | 'gemini'>('qwen');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('c_eval_gemini_key') || '';
  });
  const [geminiConfiguredOnServer, setGeminiConfiguredOnServer] = useState(false);
  const [targetCount, setTargetCount] = useState<number>(10);
  const [customCountInput, setCustomCountInput] = useState<string>('10');

  // Progressive Sequential Problem Generation State
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);
  const [generatingProblemId, setGeneratingProblemId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
    percent: number;
  } | null>(null);
  const cancelGenerationRef = useRef<boolean>(false);

  // Modals & Sub-Views
  const [activeLeetCodeProblem, setActiveLeetCodeProblem] = useState<ProblemModel | null>(null);
  const [editingProblem, setEditingProblem] = useState<ProblemModel | null>(null);
  const [isAddJsonModalOpen, setIsAddJsonModalOpen] = useState(false);
  const [isRawTextModalOpen, setIsRawTextModalOpen] = useState(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);

  // Add JSON Modal Form State
  const [jsonMode, setJsonMode] = useState<'single' | 'multi'>('multi');
  const [jsonText, setJsonText] = useState('');
  const [jsonValidationResult, setJsonValidationResult] = useState<{
    valid: boolean | null;
    message: string | null;
    previewCount?: number;
    previewTitle?: string;
  }>({ valid: null, message: null });
  const [isValidatingJson, setIsValidatingJson] = useState(false);

  // Raw Text Form State
  const [rawText, setRawText] = useState(DEFAULT_13_QUESTIONS);
  const [rawPackTitle, setRawPackTitle] = useState('Week 2: Conditionals, Operators & Arithmetic');
  const [isParsingText, setIsParsingText] = useState(false);

  // Deployment State
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  // Initial Load: Check server health & weeks
  useEffect(() => {
    fetchGeminiStatus()
      .then((status) => setGeminiConfiguredOnServer(status.configured))
      .catch(console.error);

    fetchWeeks()
      .then((list) => {
        setWeeks(list);
        if (list.length > 0) setSelectedWeekId(list[0].id);
      })
      .catch(console.error);

    // Automatically initialize with default 13 questions pack if empty
    parseProblemText(DEFAULT_13_QUESTIONS, 'week-02-c-mastery', 'Week 2: Conditionals, Operators & Arithmetic')
      .then((res) => {
        classifyProblemPack(res.pack)
          .then((classified) => setPack(classified.pack))
          .catch(() => setPack(res.pack));
      })
      .catch(console.error);
  }, []);

  const handleApiKeyChange = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('c_eval_gemini_key', key);
  };

  // ============================================================================
  // JSON IMPORT / LOAD LOGIC (Single Problem or Multi-Problem Pack)
  // ============================================================================
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
        const isSingle = count === 1;
        setJsonValidationResult({
          valid: true,
          message: isSingle
            ? `✓ Valid Single Problem: "${valRes.pack.problems[0].title || valRes.pack.problems[0].problem_id}"`
            : `✓ Valid Problem Pack: "${valRes.pack.title}" (${count} problems)`,
          previewCount: count,
          previewTitle: valRes.pack.title,
        });
      } else {
        setJsonValidationResult({
          valid: false,
          message: valRes.error || 'Schema validation failed',
        });
      }
    } catch (err: any) {
      setJsonValidationResult({
        valid: false,
        message: `JSON Syntax Error: ${err.message}`,
      });
    } finally {
      setIsValidatingJson(false);
    }
  };

  const handleFileDropJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleValidateJsonInput(text);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyJsonImport = async () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText);
      const valRes = await validateProblemPackJson(parsed);
      if (valRes.valid && valRes.pack) {
        if (jsonMode === 'single' && pack && pack.problems.length > 0) {
          // If single problem and pack exists, append or replace
          const singleProb = valRes.pack.problems[0];
          const exists = pack.problems.some((p) => p.problem_id === singleProb.problem_id);
          const nextProblems = exists
            ? pack.problems.map((p) => (p.problem_id === singleProb.problem_id ? singleProb : p))
            : [...pack.problems, singleProb];
          setPack({
            ...pack,
            problems: nextProblems,
            total_problems: nextProblems.length,
          });
        } else {
          setPack(valRes.pack);
        }
        setIsAddJsonModalOpen(false);
        setJsonText('');
        setJsonValidationResult({ valid: null, message: null });
      } else {
        alert(`Cannot import: ${valRes.error}`);
      }
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    }
  };

  const handleLoadSampleToModal = async (type: 'single' | 'multi') => {
    try {
      if (type === 'single') {
        const sampleSingle = await fetchSampleProblemJson();
        const jsonStr = JSON.stringify(sampleSingle, null, 2);
        setJsonMode('single');
        handleValidateJsonInput(jsonStr);
      } else {
        const samplePack = await fetchSampleProblemPack();
        const jsonStr = JSON.stringify(samplePack, null, 2);
        setJsonMode('multi');
        handleValidateJsonInput(jsonStr);
      }
    } catch (err: any) {
      alert(`Failed to load sample: ${err.message}`);
    }
  };

  // ============================================================================
  // DOWNLOAD SAMPLE JSON (Single Problem or Multi-Problem Pack)
  // ============================================================================
  const handleDownloadSampleDirect = async (type: 'single' | 'multi') => {
    try {
      setIsDownloadDropdownOpen(false);
      if (type === 'single') {
        const sample = await fetchSampleProblemJson();
        const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_single_problem.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const sample = await fetchSampleProblemPack();
        const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_problem_pack_13_problems.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // Export current pack JSON
  const handleExportCurrentPack = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.problem_pack_id || 'c_problem_pack'}_canonical.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // RAW TEXT PARSE & CLASSIFY
  // ============================================================================
  const handleParseRawTextSubmit = async () => {
    if (!rawText.trim()) return;
    setIsParsingText(true);
    try {
      const res = await parseProblemText(rawText, 'pack-' + Date.now().toString(36), rawPackTitle);
      const classified = await classifyProblemPack(res.pack);
      setPack(classified.pack);
      setIsRawTextModalOpen(false);
    } catch (err: any) {
      alert(`Failed to parse text: ${err.message}`);
    } finally {
      setIsParsingText(false);
    }
  };

  // ============================================================================
  // SEQUENTIAL PROBLEM-BY-PROBLEM TEST CASE GENERATION
  // (Avoids Context Window Limits & Displays Each Problem Progressively)
  // ============================================================================
  const handleGenerateAllSeparately = async () => {
    if (!pack || pack.problems.length === 0) return;
    setIsGeneratingPack(true);
    cancelGenerationRef.current = false;

    const total = pack.problems.length;
    setGenerationProgress({
      current: 1,
      total,
      currentTitle: pack.problems[0].title || `Problem 1`,
      percent: 0,
    });

    for (let i = 0; i < total; i++) {
      if (cancelRefChecked()) break;

      const currentProb = pack.problems[i];
      setGeneratingProblemId(currentProb.problem_id);
      setGenerationProgress({
        current: i + 1,
        total,
        currentTitle: currentProb.title || `Problem ${i + 1}`,
        percent: Math.round((i / total) * 100),
      });

      try {
        // Individual single-problem request: stays safely within model context window
        const res = await generateProblemTestCases(
          currentProb,
          modelProvider,
          targetCount,
          geminiApiKey
        );

        // PROGRESSIVE STATE UPDATE: Immediately update pack so problem i is visible & testable!
        setPack((prev) => {
          if (!prev) return prev;
          const nextProblems = [...prev.problems];
          nextProblems[i] = res.problem;
          return {
            ...prev,
            problems: nextProblems,
            generation_status: i === total - 1 ? 'generated' : prev.generation_status,
          };
        });
      } catch (err: any) {
        console.error(`Error generating problem ${currentProb.problem_id}:`, err);
      }
    }

    setGenerationProgress({
      current: total,
      total,
      currentTitle: 'All Problem Generations Completed!',
      percent: 100,
    });
    setIsGeneratingPack(false);
    setGeneratingProblemId(null);
  };

  const cancelRefChecked = () => {
    return cancelGenerationRef.current;
  };

  const handleStopGeneration = () => {
    cancelGenerationRef.current = true;
    setIsGeneratingPack(false);
    setGeneratingProblemId(null);
    setGenerationProgress(null);
  };

  // Generate single problem directly
  const handleGenerateSingleProblem = async (problem: ProblemModel) => {
    setGeneratingProblemId(problem.problem_id);
    try {
      const res = await generateProblemTestCases(problem, modelProvider, targetCount, geminiApiKey);
      if (pack) {
        const nextProblems = pack.problems.map((p) =>
          p.problem_id === problem.problem_id ? res.problem : p
        );
        setPack({ ...pack, problems: nextProblems });
      }
    } catch (err: any) {
      alert(`Generation failed for ${problem.problem_id}: ${err.message}`);
    } finally {
      setGeneratingProblemId(null);
    }
  };

  // Division Approval
  const handleApproveDivision = () => {
    if (!pack) return;
    const updated = pack.problems.map((p) => ({ ...p, division_approved: true }));
    setPack({
      ...pack,
      problems: updated,
      generation_status: 'division_approved',
    });
  };

  // Deploy to Lab Week
  const handleDeployToWeek = async () => {
    if (!pack || !selectedWeekId) return;
    setIsDeploying(true);
    setDeployMessage(null);
    try {
      const res = await deployProblemPackToWeek(selectedWeekId, pack);
      setDeployMessage(`✓ Deployed ${res.deployed_problems} problems to week!`);
    } catch (err: any) {
      setDeployMessage(`Deployment failed: ${err.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ==================================================================== */}
      {/* 1. TOP HEADER & ACTION CONTROLS                                      */}
      {/* ==================================================================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              }}
            >
              <FolderArchive size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                Problem Packs
              </h1>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                AI Test Case Generation & Interactive LeetCode Practice Workspace
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Add JSON, Download Sample JSON, New from Raw, Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Add JSON Button */}
          <button
            onClick={() => {
              setJsonMode('multi');
              setIsAddJsonModalOpen(true);
            }}
            className="btn btn-primary btn-sm"
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
            }}
          >
            <Upload size={15} />
            <span>Add / Import JSON</span>
          </button>

          {/* Download Sample JSON Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              <span>Download Sample JSON</span>
              <ChevronDown size={14} />
            </button>

            {isDownloadDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                  zIndex: 100,
                  width: '260px',
                  padding: '6px',
                }}
              >
                <button
                  onClick={() => handleDownloadSampleDirect('multi')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <strong style={{ color: '#38bdf8' }}>Multi-Problem Pack (Sample)</strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Complete 13 C curriculum questions pack
                  </span>
                </button>

                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                <button
                  onClick={() => handleDownloadSampleDirect('single')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <strong style={{ color: '#10b981' }}>Single Problem (Sample)</strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Standalone question with test cases
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* New from Raw Text */}
          <button
            onClick={() => setIsRawTextModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={15} />
            <span>Paste Questions Text</span>
          </button>

          {/* Export JSON */}
          {pack && (
            <button
              onClick={handleExportCurrentPack}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Export canonical JSON"
            >
              <FileCode size={15} />
              <span>Export Pack</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. PROGRESSIVE GENERATION BANNER (If generating in background)        */}
      {/* ==================================================================== */}
      {generationProgress && (
        <div
          className="card"
          style={{
            padding: '18px 24px',
            marginBottom: '24px',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(14, 165, 233, 0.05) 100%)',
            boxShadow: '0 4px 20px rgba(2, 132, 199, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}
              >
                <Zap size={16} className={isGeneratingPack ? 'spin' : ''} />
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)' }}>
                  {isGeneratingPack
                    ? `Generating Problem ${generationProgress.current} of ${generationProgress.total}:`
                    : 'Problem Generation Complete'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                  {generationProgress.currentTitle}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {generationProgress.current} / {generationProgress.total} processed
              </span>
              {isGeneratingPack && (
                <button
                  onClick={handleStopGeneration}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)' }}
                >
                  <X size={14} />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'var(--bg)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${generationProgress.percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8 0%, #10b981 100%)',
                borderRadius: '999px',
                transition: 'width 0.35s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span>Separate individual requests (context limit safe)</span>
            <span>{generationProgress.percent}% completed</span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PACK CONTROLS & GENERATION CONFIG BAR                             */}
      {/* ==================================================================== */}
      {pack && (
        <div
          className="card"
          style={{
            padding: '20px 24px',
            marginBottom: '24px',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Pack Header Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  {pack.title}
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: pack.generation_status === 'division_approved' ? '#10b98120' : '#38bdf820',
                    color: pack.generation_status === 'division_approved' ? '#10b981' : '#38bdf8',
                    border: `1px solid ${pack.generation_status === 'division_approved' ? '#10b98140' : '#38bdf840'}`,
                    fontWeight: 700,
                  }}
                >
                  {pack.problems.length} Problem{pack.problems.length === 1 ? '' : 's'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Pack ID: <code>{pack.problem_pack_id}</code> • Language: <code>{pack.language}</code>
              </p>
            </div>

            {/* Division Approval & Generate All Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {!pack.problems.every((p) => p.division_approved) ? (
                <button onClick={handleApproveDivision} className="btn btn-secondary btn-sm">
                  <Check size={14} />
                  <span>Approve Division</span>
                </button>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#10b981',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '6px',
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Division Approved</span>
                </span>
              )}

              {/* GENERATE ALL PROBLEMS SEPARATELY */}
              <button
                onClick={handleGenerateAllSeparately}
                disabled={isGeneratingPack}
                className="btn btn-primary btn-sm"
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                }}
              >
                <Zap size={15} />
                <span>
                  {isGeneratingPack
                    ? `Generating Progressively...`
                    : `Generate All Separately (${pack.problems.length} Problems)`}
                </span>
              </button>
            </div>
          </div>

          {/* Model Selection & Case Target Toolbar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
            }}
          >
            {/* Model Provider Toggle */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                AI Model Provider:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setModelProvider('qwen')}
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: modelProvider === 'qwen' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg)',
                    border: modelProvider === 'qwen' ? '1px solid #38bdf8' : '1px solid var(--border)',
                    color: modelProvider === 'qwen' ? '#38bdf8' : 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  ⚡ Local Qwen 2.5 Coder (100% GPU)
                </button>
                <button
                  onClick={() => setModelProvider('gemini')}
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: modelProvider === 'gemini' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg)',
                    border: modelProvider === 'gemini' ? '1px solid #10b981' : '1px solid var(--border)',
                    color: modelProvider === 'gemini' ? '#10b981' : 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  🌐 Google Gemini Flash API
                </button>
              </div>
            </div>

            {/* Test Count Target */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Test Cases Per Problem:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[10, 25, 50].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => {
                      setTargetCount(cnt);
                      setCustomCountInput(String(cnt));
                    }}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      background: targetCount === cnt ? 'var(--primary)' : 'var(--bg)',
                      color: targetCount === cnt ? '#ffffff' : 'var(--text-secondary)',
                      border: targetCount === cnt ? '1px solid var(--primary)' : '1px solid var(--border)',
                      fontWeight: 700,
                    }}
                  >
                    {cnt === 50 ? '50+ (Recommended)' : `${cnt} Cases`}
                  </button>
                ))}
              </div>
            </div>

            {/* Deploy to Lab Week */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Deploy to Laboratory Week:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="input"
                  style={{ flex: 1, fontSize: '0.82rem' }}
                  value={selectedWeekId}
                  onChange={(e) => setSelectedWeekId(e.target.value)}
                >
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      Week {w.week_number}: {w.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDeployToWeek}
                  disabled={isDeploying || !selectedWeekId}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}
                >
                  {isDeploying ? 'Deploying...' : 'Deploy'}
                </button>
              </div>
              {deployMessage && (
                <span style={{ fontSize: '0.74rem', color: '#10b981', marginTop: '4px', display: 'block' }}>
                  {deployMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. PROBLEM CARDS LIST (With Direct LeetCode Practice Trigger)          */}
      {/* ==================================================================== */}
      {pack && pack.problems.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
              Problems in Pack ({pack.problems.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any problem or "View Code" to test and write code against test cases
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pack.problems.map((problem, idx) => {
              const isCurrentGenerating = generatingProblemId === problem.problem_id;
              const totalCases = problem.test_cases.length;
              const passedCases = problem.test_cases.filter((tc) => tc.validation_status === 'passed').length;

              return (
                <div
                  key={problem.problem_id || idx}
                  className="card"
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    borderLeft: totalCases > 0 ? '4px solid #10b981' : '4px solid #38bdf8',
                    background: isCurrentGenerating ? 'rgba(56, 189, 248, 0.06)' : 'var(--bg-secondary)',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveLeetCodeProblem(problem)}
                >
                  {/* Left info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        {problem.problem_id || `P${idx + 1}`}
                      </span>

                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                        {problem.title || `Problem ${idx + 1}`}
                      </h4>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: '6px',
                          background: 'var(--bg)',
                          color: 'var(--text-muted)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {problem.classification?.category || 'general'}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        margin: '0 0 8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '700px',
                      }}
                    >
                      {problem.statement}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Test Cases:{' '}
                        <strong style={{ color: totalCases > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {totalCases}
                        </strong>
                      </span>

                      {totalCases > 0 && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            fontWeight: 600,
                          }}
                        >
                          ✓ {passedCases}/{totalCases} Python Verified
                        </span>
                      )}

                      {isCurrentGenerating && (
                        <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700 }}>
                          ⚡ Generating now with {modelProvider === 'qwen' ? 'Qwen (GPU)' : 'Gemini'}...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions (stop propagation so card click opens LeetCode) */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setEditingProblem(problem)}
                      className="btn btn-secondary btn-sm"
                      title="Edit statement, concepts or requirements"
                    >
                      <Edit3 size={14} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleGenerateSingleProblem(problem)}
                      disabled={isCurrentGenerating || isGeneratingPack}
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                      }}
                    >
                      <Zap size={14} />
                      <span>{isCurrentGenerating ? 'Generating...' : totalCases > 0 ? 'Regenerate' : 'Generate'}</span>
                    </button>

                    {/* OPEN LEETCODE WORKSPACE BUTTON */}
                    <button
                      onClick={() => setActiveLeetCodeProblem(problem)}
                      className="btn btn-primary btn-sm"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Code2 size={15} />
                      <span>View Code</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. ADD / IMPORT JSON MODAL (Supports Single Problem or Multi-Problem) */}
      {/* ==================================================================== */}
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
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={20} color="#38bdf8" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Add / Import JSON Problem Data
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

            {/* Quick Sample Insertion Buttons & File Upload */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Paste JSON below or upload a <code>.json</code> file:
              </span>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>Upload File</span>
                <input type="file" accept=".json" onChange={handleFileDropJson} style={{ display: 'none' }} />
              </label>
            </div>

            <textarea
              className="input"
              rows={12}
              value={jsonText}
              onChange={(e) => handleValidateJsonInput(e.target.value)}
              placeholder='Paste JSON here (e.g. {"problem_id": "P1", "statement": "..."})'
              style={{
                width: '100%',
                fontFamily: 'Consolas, monospace',
                fontSize: '0.84rem',
                lineHeight: 1.5,
                resize: 'vertical',
                marginBottom: '12px',
              }}
            />

            {/* Live Validation Alert */}
            {jsonValidationResult.valid !== null && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  background: jsonValidationResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  color: jsonValidationResult.valid ? '#10b981' : '#f43f5e',
                  border: jsonValidationResult.valid
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(244, 63, 94, 0.3)',
                }}
              >
                {jsonValidationResult.valid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{jsonValidationResult.message}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsAddJsonModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleApplyJsonImport}
                disabled={!jsonValidationResult.valid || isValidatingJson}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
              >
                <Check size={16} />
                <span>Import to Workspace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. RAW TEXT PARSER MODAL                                              */}
      {/* ==================================================================== */}
      {isRawTextModalOpen && (
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
          onClick={() => setIsRawTextModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '26px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#38bdf8" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Paste Multiline Problem Statements
                </h3>
              </div>
              <button
                onClick={() => setIsRawTextModalOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Problem Pack Title:
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={rawPackTitle}
                onChange={(e) => setRawPackTitle(e.target.value)}
              />
            </div>

            <textarea
              className="input"
              rows={12}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="1. Write a C program to check even or odd...&#10;2. Write a C program to find largest..."
              style={{
                width: '100%',
                fontFamily: 'Consolas, monospace',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                resize: 'vertical',
                marginBottom: '16px',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setRawText(DEFAULT_13_QUESTIONS)}
                className="btn btn-secondary btn-sm"
              >
                <Sparkles size={14} color="#38bdf8" />
                <span>Load 13 Curriculum Questions</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setIsRawTextModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleParseRawTextSubmit}
                  disabled={isParsingText || !rawText.trim()}
                  className="btn btn-primary"
                >
                  <Zap size={16} />
                  <span>{isParsingText ? 'Parsing...' : 'Parse & Classify'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. EDIT PROBLEM MODAL                                                 */}
      {/* ==================================================================== */}
      {editingProblem && (
        <ProblemDivisionModal
          isOpen={!!editingProblem}
          problem={editingProblem}
          onClose={() => setEditingProblem(null)}
          onSave={(updated) => {
            if (pack) {
              const next = pack.problems.map((p) =>
                p.problem_id === updated.problem_id ? updated : p
              );
              setPack({ ...pack, problems: next });
            }
            setEditingProblem(null);
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* 8. INTERACTIVE LEETCODE STYLE VIEW (When clicking problem)            */}
      {/* ==================================================================== */}
      {activeLeetCodeProblem && (
        <LeetCodeProblemView
          problem={activeLeetCodeProblem}
          onClose={() => setActiveLeetCodeProblem(null)}
          geminiApiKey={geminiApiKey}
          onUpdateProblem={(updated) => {
            setActiveLeetCodeProblem(updated);
            if (pack) {
              const next = pack.problems.map((p) =>
                p.problem_id === updated.problem_id ? updated : p
              );
              setPack({ ...pack, problems: next });
            }
          }}
        />
      )}
    </div>
  );
}

export default ProblemPackView;
