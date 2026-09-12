import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  Download,
  FileCode,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Layers,
  ChevronRight,
  Eye,
  Edit3,
  Check,
  Send,
  Zap,
  Info,
  ShieldCheck,
  Code2,
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
  fetchWeeks,
  generatePackTestCases,
  generateProblemTestCases,
  parseProblemText,
  validateProblemPackJson,
} from '../services/api';
import { ProblemDivisionModal } from '../components/ProblemDivisionModal';
import { LeetCodeProblemView } from '../components/LeetCodeProblemView';

const EXAMPLE_13_PROBLEMS = `1. Write a C program to check whether a given number is even or odd.
2. Write a C program to check whether a given number is positive, negative, or zero.
3. Write a C program to input any character and check whether it is uppercase, lowercase, digit, or special character.
4. Write a C program to check whether a given year is a leap year or not according to the Gregorian calendar rules.
5. Write a C program to display the memory size (using sizeof operator) of various basic data types (int, char, float, double).
6. Write a menu-driven calculator program in C using switch-case supporting operations (1: Add, 2: Subtract, 3: Multiply, 4: Divide, 5: Modulus). Handle division by zero and invalid choices.
7. Write a C program to swap two numbers using temporary variables and without using a third temporary variable.
8. Write a C program to check whether a number is a perfect square without using the built-in sqrt() library function.
9. Write a C program that calculates student grade based on marks obtained out of 100 using conditional statements (>=90: A, >=80: B, >=70: C, >=60: D, <60: Fail).
10. Write a C program to find the largest of three numbers using the ternary operator (? :).
11. Write a C program to print the multiplication table of any given number n up to 10.
12. Write a C program to reverse a given integer and check whether it is a palindrome.
13. Write a C program to find the sum of all digits of a given positive integer.
`;

export function ProblemEngineView() {
  // Navigation tabs within problem engine
  const [activeTab, setActiveTab] = useState<'raw' | 'upload' | 'json'>('raw');
  const [rawText, setRawText] = useState(EXAMPLE_13_PROBLEMS);
  const [packTitle, setPackTitle] = useState('Laboratory Problem Pack');

  // Pack State
  const [pack, setPack] = useState<ProblemPackModel | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);

  // Model & Test Count Generation Configuration
  const [modelProvider, setModelProvider] = useState<'qwen' | 'gemini'>('qwen');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('c_eval_gemini_key') || '';
  });
  const [geminiConfiguredOnServer, setGeminiConfiguredOnServer] = useState(false);
  const [targetCount, setTargetCount] = useState<number>(50);
  const [customCountInput, setCustomCountInput] = useState<string>('50');

  // Generation Progress
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);
  const [generatingProblemId, setGeneratingProblemId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);

  // JSON Import & Live Validation
  const [jsonValidationStatus, setJsonValidationStatus] = useState<{
    valid: boolean | null;
    error: string | null;
  }>({ valid: null, error: null });

  // Modals & LeetCode View
  const [editingProblem, setEditingProblem] = useState<ProblemModel | null>(null);
  const [activeLeetCodeProblem, setActiveLeetCodeProblem] = useState<ProblemModel | null>(null);

  // Laboratory Weeks Deployment
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

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
  }, []);

  const handleApiKeyChange = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('c_eval_gemini_key', key);
  };

  // Step 1: Parse Raw Text
  const handleParseRawText = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const res = await parseProblemText(rawText, 'pack-01', packTitle);
      // Automatically classify with Qwen/heuristics
      setIsClassifying(true);
      const classified = await classifyProblemPack(res.pack);
      setPack(classified.pack);
    } catch (err: any) {
      alert(`Parsing failed: ${err.message}`);
    } finally {
      setIsParsing(false);
      setIsClassifying(false);
    }
  };

  // Step 2: Handle File Upload (.txt / .md)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setActiveTab('raw');
      }
    };
    reader.readAsText(file);
  };

  // Step 3: Handle Canonical JSON Upload & Live Validation
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      try {
        const valRes = await validateProblemPackJson(content);
        if (valRes.valid && valRes.pack) {
          setJsonValidationStatus({ valid: true, error: null });
          setPack(valRes.pack);
        } else {
          setJsonValidationStatus({ valid: false, error: valRes.error || 'Invalid ProblemPack Schema' });
        }
      } catch (err: any) {
        setJsonValidationStatus({ valid: false, error: err.message });
      }
    };
    reader.readAsText(file);
  };

  // Step 4: Download Sample Canonical JSON
  const handleDownloadSample = async () => {
    try {
      const sample = await fetchSampleProblemPack();
      const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_problem_pack_v1.0.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to download sample: ${err.message}`);
    }
  };

  // Step 5: Division Approval
  const handleApproveDivision = () => {
    if (!pack) return;
    const updatedProblems = pack.problems.map((p) => ({ ...p, division_approved: true }));
    setPack({
      ...pack,
      problems: updatedProblems,
      generation_status: 'division_approved',
    });
  };

  // Step 6: Single Problem Test Case Generation
  const handleGenerateProblem = async (problem: ProblemModel) => {
    setGeneratingProblemId(problem.problem_id);
    try {
      const res = await generateProblemTestCases(problem, modelProvider, targetCount, geminiApiKey);
      if (pack) {
        const updatedProblems = pack.problems.map((p) =>
          p.problem_id === problem.problem_id ? res.problem : p
        );
        setPack({ ...pack, problems: updatedProblems });
      }
    } catch (err: any) {
      alert(`Generation failed for ${problem.problem_id}: ${err.message}`);
    } finally {
      setGeneratingProblemId(null);
    }
  };

  // Step 7: Sequential Generation for Full Pack
  const handleGenerateAllCases = async () => {
    if (!pack) return;
    setIsGeneratingPack(true);
    const total = pack.problems.length;
    setGenerationProgress({ current: 0, total });

    try {
      const updatedProblems = [...pack.problems];
      for (let i = 0; i < total; i++) {
        setGenerationProgress({ current: i + 1, total });
        setGeneratingProblemId(updatedProblems[i].problem_id);
        const res = await generateProblemTestCases(
          updatedProblems[i],
          modelProvider,
          targetCount,
          geminiApiKey
        );
        updatedProblems[i] = res.problem;
      }
      setPack({
        ...pack,
        problems: updatedProblems,
        generation_status: 'generated',
      });
    } catch (err: any) {
      alert(`Sequential generation error: ${err.message}`);
    } finally {
      setIsGeneratingPack(false);
      setGeneratingProblemId(null);
      setGenerationProgress(null);
    }
  };

  // Step 8: Export Canonical JSON
  const handleExportJson = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.problem_pack_id || 'problem_pack'}_canonical_v1.0.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Step 9: Deploy to Laboratory Week
  const handleDeployToWeek = async () => {
    if (!pack || !selectedWeekId) return;
    setIsDeploying(true);
    setDeployMessage(null);
    try {
      const res = await deployProblemPackToWeek(selectedWeekId, pack);
      setDeployMessage(res.message);
    } catch (err: any) {
      setDeployMessage(`Deployment error: ${err.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  // Update Problem from Modal or LeetCode View
  const handleProblemUpdated = (updated: ProblemModel) => {
    if (!pack) return;
    const updatedProblems = pack.problems.map((p) =>
      p.problem_id === updated.problem_id ? updated : p
    );
    setPack({ ...pack, problems: updatedProblems });
  };

  return (
    <div style={{ padding: '0 0 60px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              Independent Core Module
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Schema v1.0 • Deterministic Python Verification
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>
            Problem Pack Engine & AI Generator
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '750px' }}>
            Transform raw assignment text into production-ready C problem packs. Generate 50+ deterministic test cases with local Qwen 2.5 Coder or Google Gemini Flash, inspect in a LeetCode workspace, and deploy directly to laboratory weeks.
          </p>
        </div>

        <button onClick={handleDownloadSample} className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
          <Download size={16} />
          <span>Sample JSON</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* STEP 1: INPUT & UPLOAD SECTION */}
      {/* ==================================================================== */}
      {!pack && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              padding: '0 16px',
              background: 'var(--bg-secondary)',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
            }}
          >
            <button
              onClick={() => setActiveTab('raw')}
              style={{
                padding: '14px 20px',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'raw' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'raw' ? '2px solid var(--primary)' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FileText size={16} />
              <span>Raw Text Paste</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              style={{
                padding: '14px 20px',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'upload' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'upload' ? '2px solid var(--primary)' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Upload size={16} />
              <span>Upload Document (.txt / .md)</span>
            </button>

            <button
              onClick={() => setActiveTab('json')}
              style={{
                padding: '14px 20px',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'json' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'json' ? '2px solid var(--primary)' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FileCode size={16} />
              <span>Upload Canonical JSON (v1.0)</span>
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {/* TAB A: RAW TEXT */}
            {activeTab === 'raw' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                    Paste Raw Problem Statements:
                  </label>
                  <button
                    onClick={() => setRawText(EXAMPLE_13_PROBLEMS)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem' }}
                  >
                    <Sparkles size={14} color="#38bdf8" />
                    <span>Load Standard 13 Lab Problems</span>
                  </button>
                </div>

                <textarea
                  className="input"
                  rows={10}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="1. Write a C program to check even or odd...&#10;2. Write a C program to find largest of three numbers..."
                  style={{
                    width: '100%',
                    fontFamily: 'Consolas, monospace',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    resize: 'vertical',
                    marginBottom: '16px',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Supports varied prefixes: <code>1.</code>, <code>P1:</code>, <code>Problem 1:</code>, <code>1)</code>. Multiline statements are preserved verbatim.
                  </div>
                  <button
                    onClick={handleParseRawText}
                    disabled={isParsing || !rawText.trim()}
                    className="btn btn-primary"
                  >
                    <Zap size={16} />
                    <span>{isParsing ? 'Parsing & Classifying...' : '⚡ Parse & Classify Problems'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB B: FILE UPLOAD */}
            {activeTab === 'upload' && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    background: 'var(--bg-secondary)',
                    maxWidth: '500px',
                    margin: '0 auto',
                  }}
                >
                  <Upload size={36} color="var(--primary)" style={{ marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px' }}>
                    Select .txt or .md Problem File
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Upload syllabus questions, lab assignment outlines, or markdown problem notes.
                  </p>
                  <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                    <Upload size={16} />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept=".txt,.md"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB C: CANONICAL JSON */}
            {activeTab === 'json' && (
              <div style={{ padding: '10px 0' }}>
                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: '12px',
                    padding: '30px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    marginBottom: '20px',
                  }}
                >
                  <FileCode size={36} color="#38bdf8" style={{ marginBottom: '10px' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px' }}>
                    Upload Canonical ProblemPack JSON
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Strict validation against schema version <code>1.0</code> with non-destructive round-trip restoration.
                  </p>
                  <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                    <Upload size={16} />
                    <span>Select JSON File</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleJsonUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {jsonValidationStatus.valid === false && (
                  <div
                    style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: '#f43f5e',
                      fontSize: '0.85rem',
                    }}
                  >
                    <AlertCircle size={18} />
                    <span>Validation Failed: {jsonValidationStatus.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 2: LOADED PACK DASHBOARD & WORKFLOW */}
      {/* ==================================================================== */}
      {pack && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Controls Bar */}
          <div
            className="card"
            style={{
              padding: '18px 24px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              background: 'var(--bg-secondary)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{pack.title}</h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: pack.generation_status === 'division_approved' ? '#10b98120' : '#38bdf820',
                    color: pack.generation_status === 'division_approved' ? '#10b981' : '#38bdf8',
                    border: `1px solid ${pack.generation_status === 'division_approved' ? '#10b98140' : '#38bdf840'}`,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  Status: {pack.generation_status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {pack.problems.length} detected problems • Target Language: {pack.language}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setPack(null)}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={14} />
                <span>Re-parse / New Pack</span>
              </button>

              <button
                onClick={handleExportJson}
                className="btn btn-secondary btn-sm"
              >
                <Download size={14} />
                <span>Export JSON (v1.0)</span>
              </button>
            </div>
          </div>

          {/* GENERATION CONFIGURATION PANEL */}
          <div
            className="card"
            style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '14px' }}>
              Generation Settings: Dual-Model & Case Volume
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Model Selection */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  AI Generator Model:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: modelProvider === 'qwen' ? '2px solid #38bdf8' : '1px solid var(--border)',
                      background: modelProvider === 'qwen' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="radio"
                      name="provider"
                      checked={modelProvider === 'qwen'}
                      onChange={() => setModelProvider('qwen')}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                        Qwen 2.5 Coder 3B
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Local via Ollama (Offline fallback)
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: modelProvider === 'gemini' ? '2px solid #a855f7' : '1px solid var(--border)',
                      background: modelProvider === 'gemini' ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="radio"
                      name="provider"
                      checked={modelProvider === 'gemini'}
                      onChange={() => setModelProvider('gemini')}
                      style={{ accentColor: '#a855f7' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                        Google Gemini Flash
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Cloud API (High speed 50+ cases)
                      </div>
                    </div>
                  </label>
                </div>

                {/* Gemini API Key input if Gemini selected */}
                {modelProvider === 'gemini' && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Gemini API Key:</span>
                      <span style={{ fontSize: '0.72rem', color: geminiConfiguredOnServer ? '#10b981' : '#f59e0b' }}>
                        {geminiConfiguredOnServer ? '🟢 Configured in .env' : '⚪ Not found in .env'}
                      </span>
                    </div>
                    <input
                      type="password"
                      className="input"
                      style={{ width: '100%', fontSize: '0.82rem' }}
                      value={geminiApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="Enter AIzaSy... or leave blank to use server .env"
                    />
                  </div>
                )}
              </div>

              {/* Number of Test Cases Target */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Test Cases Target Per Problem:
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  {[10, 25, 50].map((count) => (
                    <button
                      key={count}
                      onClick={() => {
                        setTargetCount(count);
                        setCustomCountInput(String(count));
                      }}
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: targetCount === count ? 'var(--primary)' : 'var(--bg-secondary)',
                        color: targetCount === count ? '#ffffff' : 'var(--text-secondary)',
                        border: targetCount === count ? '1px solid var(--primary)' : '1px solid var(--border)',
                        fontWeight: 700,
                      }}
                    >
                      {count === 50 ? '50+ (Recommended)' : `${count} Cases`}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Custom Count:</span>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    className="input"
                    style={{ width: '80px', padding: '4px 8px', fontSize: '0.82rem' }}
                    value={customCountInput}
                    onChange={(e) => {
                      setCustomCountInput(e.target.value);
                      const num = parseInt(e.target.value, 10);
                      if (!isNaN(num) && num > 0) setTargetCount(num);
                    }}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    (Includes Base, Boundary, Edge, Stress, Metamorphic)
                  </span>
                </div>
              </div>
            </div>

            {/* Division Approval & Generate All Action */}
            <div
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                {!pack.problems.every((p) => p.division_approved) ? (
                  <button onClick={handleApproveDivision} className="btn btn-secondary">
                    <Check size={16} />
                    <span>Approve Problem Division</span>
                  </button>
                ) : (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#10b981',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                    }}
                  >
                    <ShieldCheck size={18} />
                    <span>Division Approved by Teacher</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {generationProgress && (
                  <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                    Generating {generationProgress.current} / {generationProgress.total}...
                  </span>
                )}

                <button
                  onClick={handleGenerateAllCases}
                  disabled={isGeneratingPack}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  <Zap size={16} />
                  <span>
                    {isGeneratingPack
                      ? `Generating Pack (${targetCount}+ Cases)...`
                      : `⚡ Generate All Test Cases (${targetCount}+ per problem)`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* PROBLEMS LIST & LEETCODE WORKSPACE TRIGGER */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                Laboratory Problems ({pack.problems.length})
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Click any problem to open the interactive Code Workspace
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {pack.problems.map((problem) => {
                const isCurrentGenerating = generatingProblemId === problem.problem_id;
                const totalCases = problem.test_cases.length;
                const verifiedCases = problem.test_cases.filter((tc) => tc.validation_status === 'passed').length;

                return (
                  <div
                    key={problem.problem_id}
                    className="card"
                    style={{
                      padding: '18px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      borderLeft: '4px solid var(--primary)',
                      background: 'var(--bg-secondary)',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                          }}
                        >
                          {problem.problem_id}
                        </span>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                          {problem.title}
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
                          {problem.classification.category}
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
                          maxWidth: '750px',
                        }}
                      >
                        {problem.statement}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Test Cases: <strong style={{ color: totalCases > 0 ? '#10b981' : 'var(--text-muted)' }}>{totalCases}</strong>
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
                            }}
                          >
                            ✓ {verifiedCases}/{totalCases} Python Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions: Edit, Generate, Open in LeetCode */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => setEditingProblem(problem)}
                        className="btn btn-secondary btn-sm"
                        title="Edit problem title, statement, or concepts"
                      >
                        <Edit3 size={14} />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleGenerateProblem(problem)}
                        disabled={isCurrentGenerating || isGeneratingPack}
                        className="btn btn-secondary btn-sm"
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        <Zap size={14} />
                        <span>
                          {isCurrentGenerating
                            ? 'Generating...'
                            : totalCases > 0
                            ? 'Regenerate'
                            : `Generate (${targetCount}+)`}
                        </span>
                      </button>

                      {/* LEETCODE WORKSPACE TRIGGER */}
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

          {/* DEPLOY TO LABORATORY WEEK */}
          <div
            className="card"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
                Deploy to Laboratory Week
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Commit this Problem Pack into the database so student batch submissions and viva evaluations can run immediately.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select
                className="input"
                style={{ width: '220px', fontSize: '0.85rem' }}
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
                className="btn btn-primary"
              >
                <Send size={16} />
                <span>{isDeploying ? 'Deploying...' : 'Deploy to Lab Week'}</span>
              </button>
            </div>
          </div>

          {deployMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: deployMessage.includes('error') ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${deployMessage.includes('error') ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                color: deployMessage.includes('error') ? '#f43f5e' : '#10b981',
                fontSize: '0.85rem',
              }}
            >
              {deployMessage}
            </div>
          )}
        </div>
      )}

      {/* MODAL: EDIT PROBLEM DIVISION */}
      <ProblemDivisionModal
        isOpen={Boolean(editingProblem)}
        problem={editingProblem}
        onClose={() => setEditingProblem(null)}
        onSave={handleProblemUpdated}
      />

      {/* LEETCODE WORKSPACE OVERLAY */}
      {activeLeetCodeProblem && (
        <LeetCodeProblemView
          problem={activeLeetCodeProblem}
          onClose={() => setActiveLeetCodeProblem(null)}
          geminiApiKey={geminiApiKey}
          onUpdateProblem={handleProblemUpdated}
        />
      )}
    </div>
  );
}
export default ProblemEngineView;
