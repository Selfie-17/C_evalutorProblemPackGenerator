import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  ListOrdered,
  Cpu,
  Key,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  RotateCw,
  Plus,
  Play,
  Check,
} from 'lucide-react';
import {
  generateProblemPack,
  generateFromQuestions,
  generateSingleQuestion,
  addDraftQuestions,
  seedDefaultPack,
} from '../services/api';
import { ProblemInPack } from '../types';

interface Props {
  weekId: string;
  weekNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onPackUpdated: (problems: ProblemInPack[]) => void;
}

export interface QuestionItem {
  id: string;
  number: number;
  text: string;
  status: 'idle' | 'generating' | 'success' | 'error';
  problem?: ProblemInPack;
  error?: string;
}

const SAMPLE_QUESTIONS = `1. Write a C program to find the largest of two numbers.
2. Write a C program to check whether a given number is positive, negative, or zero.
3. Write a C program to find the factorial of a number using a loop.
4. Write a C program to check whether a number is a palindrome or not.`;

export const GeneratePackModal: React.FC<Props> = ({
  weekId,
  weekNumber,
  isOpen,
  onClose,
  onPackUpdated,
}) => {
  const [mode, setMode] = useState<'questions' | 'seed' | 'ai'>('questions');
  const [questionsText, setQuestionsText] = useState(SAMPLE_QUESTIONS);
  const [questionsList, setQuestionsList] = useState<QuestionItem[]>([]);
  const [replaceAll, setReplaceAll] = useState(false);
  const [topicsInput, setTopicsInput] = useState('loops, conditions, arrays, functions, math');
  const [verifyWithReference, setVerifyWithReference] = useState(true);

  // Model & Provider Selection
  const [provider, setProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [geminiModel, setGeminiModel] = useState('gemini-3.8-flash');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:3b');
  const [apiKey, setApiKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Helper to parse questions from raw text
  const parseQuestionsFromRawText = (rawText: string): QuestionItem[] => {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const qPattern = /^(?:(?:Q|p|problem)?\s*\d+[\.\)\:\-]|\[\d+\])\s*/i;

    const extracted: string[] = [];
    let currentQ: string[] = [];

    for (const line of lines) {
      if (qPattern.test(line)) {
        if (currentQ.length > 0) {
          extracted.push(currentQ.join(' ').trim());
          currentQ = [];
        }
        const cleaned = line.replace(qPattern, '').trim();
        extracted.push(cleaned || line);
      } else {
        currentQ.push(line);
      }
    }
    if (currentQ.length > 0) {
      extracted.push(currentQ.join(' ').trim());
    }

    const finalTexts = extracted.length > 0 ? extracted : lines;
    return finalTexts.map((q, idx) => ({
      id: `q-${idx + 1}-${Date.now()}`,
      number: idx + 1,
      text: q,
      status: 'idle',
    }));
  };

  // Initial parse of default sample questions
  useEffect(() => {
    if (questionsList.length === 0 && questionsText) {
      setQuestionsList(parseQuestionsFromRawText(questionsText));
    }
  }, []);

  // Load saved Gemini API Key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleParseQuestions = () => {
    const parsed = parseQuestionsFromRawText(questionsText);
    setQuestionsList(parsed);
    setError('');
  };

  const handleQuestionTextChange = (index: number, newText: string) => {
    setQuestionsList((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, text: newText } : q))
    );
  };

  const handleAddQuestion = () => {
    const nextNum = questionsList.length + 1;
    setQuestionsList((prev) => [
      ...prev,
      {
        id: `q-${nextNum}-${Date.now()}`,
        number: nextNum,
        text: `Write a C program to `,
        status: 'idle',
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestionsList((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((q, idx) => ({ ...q, number: idx + 1 }))
    );
  };

  if (!isOpen) return null;

  // Single Question Generation Handler
  const handleGenerateSingle = async (index: number) => {
    const item = questionsList[index];
    if (!item || !item.text.trim()) {
      setError(`Question ${index + 1} text is empty.`);
      return;
    }

    setError('');
    setQuestionsList((prev) =>
      prev.map((q, idx) =>
        idx === index ? { ...q, status: 'generating', error: undefined } : q
      )
    );

    try {
      const res = await generateSingleQuestion(weekId, {
        question_text: item.text.trim(),
        problem_number: item.number,
        replace_existing: replaceAll || true,
        verify_with_reference: verifyWithReference,
        provider,
        model: provider === 'gemini' ? geminiModel : ollamaModel,
        api_key: apiKey.trim() || undefined,
      });

      if (res.status === 'success' && res.problem) {
        const generated = res.problem;
        setQuestionsList((prev) =>
          prev.map((q, idx) =>
            idx === index ? { ...q, status: 'success', problem: generated } : q
          )
        );
        onPackUpdated([generated]);
      } else {
        setQuestionsList((prev) =>
          prev.map((q, idx) =>
            idx === index
              ? { ...q, status: 'error', error: res.error || 'Generation failed' }
              : q
          )
        );
      }
    } catch (err: any) {
      setQuestionsList((prev) =>
        prev.map((q, idx) =>
          idx === index
            ? { ...q, status: 'error', error: err.message || 'Generation error' }
            : q
        )
      );
    }
  };

  // Add Draft Questions Directly to Week Table
  const handleAddQuestionsToTable = async () => {
    const raw = questionsText.trim();
    if (!raw && questionsList.length === 0) {
      setError('Please paste or enter at least one laboratory question.');
      return;
    }

    setLoading(true);
    setError('');
    setProgressStatus('Adding questions to problem table...');

    try {
      const qTexts = questionsList.length > 0 ? questionsList.map((q) => q.text.trim()).filter(Boolean) : undefined;
      const updatedProblems = await addDraftQuestions(weekId, {
        raw_text: raw || undefined,
        questions: qTexts,
        replace_all: replaceAll,
      });

      onPackUpdated(updatedProblems);
      setSuccessMsg(`Added ${updatedProblems.length} questions to the table! You can now generate them individually.`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to add questions to table.');
    } finally {
      setLoading(false);
      setProgressStatus('');
    }
  };

  // Generate All Questions (Sequential loop to avoid context window explosion)
  const handleGenerateAllSequential = async () => {
    if (questionsList.length === 0) {
      setError('Please paste or enter questions first.');
      return;
    }

    setIsGeneratingAll(true);
    setError('');
    setSuccessMsg('');

    for (let i = 0; i < questionsList.length; i++) {
      if (questionsList[i].status === 'success') continue;
      setProgressStatus(`Generating Q${i + 1} of ${questionsList.length}...`);
      await handleGenerateSingle(i);
      // Brief pause between calls to respect rate limits
      await new Promise((r) => setTimeout(r, 800));
    }

    setIsGeneratingAll(false);
    setProgressStatus('');
    setSuccessMsg('Completed generation of questions!');
  };

  const handleSeed = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setProgressStatus('Seeding standard curriculum problems...');
    try {
      const problems = await seedDefaultPack(weekId);
      setSuccessMsg(`Successfully seeded ${problems.length} verified problems for Week ${weekNumber}!`);
      onPackUpdated(problems);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to seed default pack.');
    } finally {
      setLoading(false);
      setProgressStatus('');
    }
  };

  const handleGenerateAI = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setProgressStatus('Generating problems & compiling reference solutions...');
    try {
      const topics = topicsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await generateProblemPack(weekId, {
        number_of_problems: 10,
        difficulty: 'Easy',
        topics,
        verify_with_reference: verifyWithReference,
        provider,
        model: provider === 'gemini' ? geminiModel : ollamaModel,
        api_key: apiKey.trim() || undefined,
      });

      if (res.status === 'success') {
        setSuccessMsg(`Successfully generated and verified ${res.total_verified} problems!`);
        onPackUpdated(res.problems);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.errors.join(', ') || 'Problem pack generation reported errors.');
      }
    } catch (err: any) {
      setError(err.message || 'AI generation failed. Check your API key or Ollama connection.');
    } finally {
      setLoading(false);
      setProgressStatus('');
    }
  };

  const successfulCount = questionsList.filter((q) => q.status === 'success').length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Add Questions — Week {weekNumber}
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ border: 'none', padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setMode('questions')}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${mode === 'questions' ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: mode === 'questions' ? 'var(--primary-light)' : 'var(--bg-surface)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  color: mode === 'questions' ? 'var(--primary)' : 'var(--text-main)',
                  marginBottom: '2px',
                  fontSize: '0.88rem',
                }}
              >
                <ListOrdered size={16} />
                <span>From Exact Questions</span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Paste questions & generate each with 5 edge-case test cases
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('seed')}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${mode === 'seed' ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: mode === 'seed' ? 'var(--primary-light)' : 'var(--bg-surface)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  color: mode === 'seed' ? 'var(--primary)' : 'var(--text-main)',
                  marginBottom: '2px',
                  fontSize: '0.88rem',
                }}
              >
                <BookOpen size={16} />
                <span>Quick Seed</span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Pre-verified standard curriculum problems
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('ai')}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${mode === 'ai' ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: mode === 'ai' ? 'var(--primary-light)' : 'var(--bg-surface)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  color: mode === 'ai' ? 'var(--primary)' : 'var(--text-main)',
                  marginBottom: '2px',
                  fontSize: '0.88rem',
                }}
              >
                <Sparkles size={16} />
                <span>Topic Generator</span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Synthesize problems from topic tags
              </p>
            </button>
          </div>

          {/* AI Engine & API Key Configuration */}
          {(mode === 'questions' || mode === 'ai') && (
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} /> AI Generation Engine
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Generates 5 targeted test cases & compiles C reference solution
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${provider === 'gemini' ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: provider === 'gemini' ? 'white' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="radio"
                    name="provider"
                    checked={provider === 'gemini'}
                    onChange={() => setProvider('gemini')}
                  />
                  <span>Google Gemini (Fast & Flash)</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${provider === 'ollama' ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: provider === 'ollama' ? 'white' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="radio"
                    name="provider"
                    checked={provider === 'ollama'}
                    onChange={() => setProvider('ollama')}
                  />
                  <span>Local Ollama (Qwen 2.5)</span>
                </label>
              </div>

              {provider === 'gemini' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      <Key size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Gemini API Key (leave empty if set in .env)
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="Enter Gemini API key..."
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: '0.82rem',
                        backgroundColor: 'white',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      Gemini Model
                    </label>
                    <select
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: '0.82rem',
                        backgroundColor: 'white',
                      }}
                    >
                      <option value="gemini-3.8-flash">gemini-3.8-flash (Latest 3.8 Flash - Recommended)</option>
                      <option value="gemini-3.7-flash">gemini-3.7-flash (3.7 Flash)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Ollama Model Name (runs on localhost:11434)
                  </label>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="qwen2.5-coder:3b"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      fontSize: '0.82rem',
                      backgroundColor: 'white',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* MODE 1: FROM EXACT QUESTIONS */}
          {mode === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Paste Raw Text Box */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Paste Your Exact Laboratory Questions
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestionsText(SAMPLE_QUESTIONS);
                        setQuestionsList(parseQuestionsFromRawText(SAMPLE_QUESTIONS));
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    >
                      <FileText size={12} />
                      <span>Load Sample</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleParseQuestions}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '3px 10px' }}
                    >
                      <Sparkles size={12} />
                      <span>Parse Questions List</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={questionsText}
                  onChange={(e) => setQuestionsText(e.target.value)}
                  placeholder={`1. Write a C program to find the largest of two numbers.\n2. Write a C program to check whether a given number is positive, negative, or zero.\n3. Write a C program to find the factorial of a number using a loop.`}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '0.84rem',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: '1.4',
                    resize: 'vertical',
                    backgroundColor: 'white',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Each question will be generated individually with <strong>5 diverse test cases</strong> (2 public + 3 hidden edge/failure cases).
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={verifyWithReference}
                        onChange={(e) => setVerifyWithReference(e.target.checked)}
                      />
                      <span>Verify with GCC</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        color: replaceAll ? '#dc2626' : 'var(--text-secondary)',
                      }}
                      title="If checked, problems overwrite existing ones in this week"
                    >
                      <input
                        type="checkbox"
                        checked={replaceAll}
                        onChange={(e) => setReplaceAll(e.target.checked)}
                      />
                      <span>Replace existing</span>
                    </label>
                  </div>
                </div>

                {/* Direct Action Banner: Add to Problem Table */}
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    backgroundColor: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ListOrdered size={18} color="#4f46e5" />
                    <div>
                      <strong style={{ fontSize: '0.84rem', color: '#312e81', display: 'block' }}>
                        Import Questions Directly to Problem Table
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: '#4338ca' }}>
                        Adds questions to your table where each row has a dedicated "⚡ Generate" button.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddQuestionsToTable}
                    disabled={loading || (!questionsText.trim() && questionsList.length === 0)}
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      fontSize: '0.84rem',
                      boxShadow: '0 2px 4px rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="spin" />
                        <span>Adding to Table...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>+ Add Questions to Problem Table</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Extracted Questions List Header & Action Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Questions List ({questionsList.length})
                  </h4>
                  {questionsList.length > 0 && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: successfulCount === questionsList.length && questionsList.length > 0 ? '#ecfdf5' : 'var(--bg-subtle)',
                        color: successfulCount === questionsList.length && questionsList.length > 0 ? '#059669' : 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {successfulCount} / {questionsList.length} Generated
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  >
                    <Plus size={13} />
                    <span>Add Question</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateAllSequential}
                    disabled={isGeneratingAll || questionsList.length === 0}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.76rem', padding: '4px 12px' }}
                  >
                    {isGeneratingAll ? (
                      <>
                        <Loader2 size={13} className="spin" />
                        <span>Generating All...</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        <span>Generate All (Sequential)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Individual Question Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {questionsList.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      border: '1px dashed var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-muted)',
                      fontSize: '0.84rem',
                    }}
                  >
                    No questions detected yet. Paste questions above or click "Load Sample" to begin.
                  </div>
                ) : (
                  questionsList.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${
                          item.status === 'success'
                            ? '#a7f3d0'
                            : item.status === 'generating'
                            ? 'var(--primary)'
                            : item.status === 'error'
                            ? '#fecaca'
                            : 'var(--border)'
                        }`,
                        backgroundColor:
                          item.status === 'success'
                            ? '#f0fdf4'
                            : item.status === 'generating'
                            ? 'var(--primary-light)'
                            : item.status === 'error'
                            ? '#fff5f5'
                            : 'white',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              color: 'var(--primary)',
                              backgroundColor: 'white',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            P{item.number}
                          </span>

                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            Question {item.number}
                          </span>

                          {/* Status Badge */}
                          {item.status === 'idle' && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
                              Ready
                            </span>
                          )}

                          {item.status === 'generating' && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Loader2 size={12} className="spin" /> Generating 5 Test Cases & GCC...
                            </span>
                          )}

                          {item.status === 'success' && (
                            <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Verified ✓ (5 Test Cases: 2 Public, 3 Hidden)
                            </span>
                          )}

                          {item.status === 'error' && (
                            <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={12} /> Failed: {item.error}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Generate Single Button */}
                          <button
                            type="button"
                            onClick={() => handleGenerateSingle(idx)}
                            disabled={item.status === 'generating' || isGeneratingAll}
                            className={`btn btn-sm ${item.status === 'success' ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ fontSize: '0.76rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            {item.status === 'generating' ? (
                              <>
                                <Loader2 size={12} className="spin" />
                                <span>Generating...</span>
                              </>
                            ) : item.status === 'success' ? (
                              <>
                                <RotateCw size={12} />
                                <span>Regenerate</span>
                              </>
                            ) : item.status === 'error' ? (
                              <>
                                <RotateCw size={12} />
                                <span>Retry</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={12} />
                                <span>Generate Problem</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            disabled={item.status === 'generating' || isGeneratingAll}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 6px', border: 'none', color: '#94a3b8' }}
                            title="Remove Question"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Question Text Input */}
                      <textarea
                        value={item.text}
                        onChange={(e) => handleQuestionTextChange(idx, e.target.value)}
                        disabled={item.status === 'generating' || isGeneratingAll}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          fontSize: '0.82rem',
                          backgroundColor: 'white',
                          fontFamily: 'inherit',
                          lineHeight: '1.4',
                          resize: 'vertical',
                        }}
                      />

                      {/* Generated Problem Preview Details */}
                      {item.status === 'success' && item.problem && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '8px 10px',
                            backgroundColor: 'white',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid #bbf7d0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                              {item.problem.title}
                            </strong>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '1px 6px',
                                borderRadius: '9999px',
                                backgroundColor: item.problem.difficulty === 'Easy' ? '#ecfdf5' : '#fffbeb',
                                color: item.problem.difficulty === 'Easy' ? '#065f46' : '#92400e',
                                fontWeight: 700,
                              }}
                            >
                              {item.problem.difficulty}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            <span>
                              <strong>{item.problem.public_test_cases?.length || 2}</strong> Public,{' '}
                              <strong>{item.problem.hidden_test_cases?.length || 3}</strong> Hidden Edge Cases
                            </span>
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              ✓ Reference C Solution Verified
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* MODE 2: QUICK SEED */}
          {mode === 'seed' && (
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '6px' }}>
                Standard Curriculum Problem Pack (Week {weekNumber})
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Seeds standard curriculum LeetCode-style C problems with 100% accurate test cases and working C solutions:
                Sum of Two Numbers, Even/Odd, Max of Three, Factorial, Palindrome, Sum of Digits, Prime Number, Fibonacci, Array Sum, and Max Element.
              </p>
            </div>
          )}

          {/* MODE 3: TOPIC GENERATOR */}
          {mode === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Difficulty is automatically assessed and assigned by the AI model.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Topics (comma-separated)
                </label>
                <input
                  type="text"
                  value={topicsInput}
                  onChange={(e) => setTopicsInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={verifyWithReference}
                  onChange={(e) => setVerifyWithReference(e.target.checked)}
                />
                <span>Verify reference C solutions with GCC against generated test cases</span>
              </label>
            </div>
          )}

          {/* Progress Indicator */}
          {loading && (
            <div
              style={{
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary-dark)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              <Loader2 size={18} className="spin" />
              <span>{progressStatus || 'Processing...'}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} disabled={loading || isGeneratingAll} className="btn btn-secondary">
            {successfulCount > 0 ? 'Done / Close' : 'Cancel'}
          </button>

          {mode === 'questions' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleAddQuestionsToTable}
                disabled={loading || isGeneratingAll || (!questionsText.trim() && questionsList.length === 0)}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  border: 'none',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Adding to Table...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Add Questions to Table ({questionsList.length})</span>
                  </>
                )}
              </button>
            </div>
          )}

          {mode === 'seed' && (
            <button type="button" onClick={handleSeed} disabled={loading} className="btn btn-primary">
              <BookOpen size={16} />
              <span>{loading ? 'Seeding Problems...' : 'Seed Problems Now'}</span>
            </button>
          )}

          {mode === 'ai' && (
            <button type="button" onClick={handleGenerateAI} disabled={loading} className="btn btn-primary">
              <Sparkles size={16} />
              <span>{loading ? 'Synthesizing Problems...' : 'Generate Problems'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
