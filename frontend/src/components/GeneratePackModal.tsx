import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Check,
  ListOrdered,
  Cpu,
  Key,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
} from 'lucide-react';
import { generateProblemPack, generateFromQuestions, seedDefaultPack } from '../services/api';
import { ProblemInPack } from '../types';

interface Props {
  weekId: string;
  weekNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onPackUpdated: (problems: ProblemInPack[]) => void;
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
  const [questionsText, setQuestionsText] = useState('');
  const [replaceAll, setReplaceAll] = useState(false);
  const [topicsInput, setTopicsInput] = useState('loops, conditions, arrays, functions, math');
  const [verifyWithReference, setVerifyWithReference] = useState(true);

  // Model & Provider Selection
  const [provider, setProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [geminiModel, setGeminiModel] = useState('gemini-3.7-flash');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:3b');
  const [apiKey, setApiKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  // Helper to count detected questions in the text
  const detectQuestionCount = (text: string): number => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return 0;
    const qPattern = /^(?:(?:Q|p|problem)?\s*\d+[\.\)\:\-]|\[\d+\])\s*/i;
    let count = 0;
    for (const line of lines) {
      if (qPattern.test(line)) {
        count++;
      }
    }
    return count > 0 ? count : lines.length;
  };

  const detectedQuestionsCount = detectQuestionCount(questionsText);

  if (!isOpen) return null;

  const handleSeed = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setProgressStatus('Seeding standard 10 curriculum problems...');
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

  const handleGenerateFromQuestions = async () => {
    if (!questionsText.trim()) {
      setError('Please enter at least one question or click "Load Sample Questions".');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setProgressStatus(
      provider === 'gemini'
        ? 'Calling Gemini & compiling reference C solutions with GCC...'
        : 'Querying local Ollama (qwen2.5-coder:3b) & compiling with GCC...'
    );

    try {
      const res = await generateFromQuestions(weekId, {
        raw_text: questionsText,
        verify_with_reference: verifyWithReference,
        provider,
        model: provider === 'gemini' ? geminiModel : ollamaModel,
        api_key: apiKey.trim() || undefined,
        replace_all: replaceAll,
      });

      if (res.status === 'success' && res.problems.length > 0) {
        setSuccessMsg(
          `Successfully generated ${res.total_generated} problems (${res.total_verified} verified with GCC)!`
        );
        onPackUpdated(res.problems);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.errors.join(', ') || 'Failed to generate problems from questions.');
      }
    } catch (err: any) {
      setError(err.message || 'Generation failed. Check your API key or Ollama connection.');
    } finally {
      setLoading(false);
      setProgressStatus('');
    }
  };

  const handleGenerateAI = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setProgressStatus('Generating 10 problems & compiling reference solutions...');
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Setup Problem Pack — Week {weekNumber}
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
                Paste your laboratory questions directly
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
                10 pre-verified standard curriculum problems
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

          {/* AI Engine & API Key Configuration (for 'questions' and 'ai' modes) */}
          {(mode === 'questions' || mode === 'ai') && (
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} /> AI Generation Engine
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Generates test cases & verifies reference C code
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
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: '0.84rem',
                        backgroundColor: 'white',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Gemini Model
                    </label>
                    <select
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: '0.84rem',
                        backgroundColor: 'white',
                      }}
                    >
                      <option value="gemini-3.7-flash">gemini-3.7-flash (Latest 3.7 Flash - Recommended)</option>
                      <option value="gemini-3.8-flash">gemini-3.8-flash (Latest 3.8 Flash)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Ollama Model Name (runs on localhost:11434)
                  </label>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="qwen2.5-coder:3b"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      fontSize: '0.84rem',
                      backgroundColor: 'white',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* MODE 1: FROM EXACT QUESTIONS */}
          {mode === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Paste Your Exact Laboratory Questions
                </label>
                <button
                  type="button"
                  onClick={() => setQuestionsText(SAMPLE_QUESTIONS)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                >
                  <FileText size={12} />
                  <span>Load Sample Questions</span>
                </button>
              </div>

              <textarea
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                placeholder={`1. Write a C program to find the largest of two numbers.
2. Write a C program to check whether a given number is positive, negative, or zero.
3. Write a C program to reverse an array in-place.
4. Write a C program to check if a matrix is symmetric.`}
                rows={7}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: '1.5',
                  resize: 'vertical',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: detectedQuestionsCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                  }}
                >
                  {detectedQuestionsCount > 0
                    ? `✓ Detected ${detectedQuestionsCount} question(s) — will generate P1 to P${detectedQuestionsCount}`
                    : 'Paste questions numbered 1., 2. or separated by lines'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
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
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      color: replaceAll ? '#dc2626' : 'var(--text-secondary)',
                    }}
                    title="If unchecked, new questions will be appended to existing problems"
                  >
                    <input
                      type="checkbox"
                      checked={replaceAll}
                      onChange={(e) => setReplaceAll(e.target.checked)}
                    />
                    <span>Replace existing problems</span>
                  </label>

                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Difficulty: Auto-classified by Model
                  </span>
                </div>
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
                Seeds 10 pre-tested, verified LeetCode-style C problems with 100% accurate test cases and working C solutions:
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
          <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
            Cancel
          </button>

          {mode === 'questions' && (
            <button
              type="button"
              onClick={handleGenerateFromQuestions}
              disabled={loading || !questionsText.trim()}
              className="btn btn-primary"
            >
              <Sparkles size={16} />
              <span>{loading ? 'Generating Problems...' : `Generate ${detectedQuestionsCount || ''} Problems from Questions`}</span>
            </button>
          )}

          {mode === 'seed' && (
            <button type="button" onClick={handleSeed} disabled={loading} className="btn btn-primary">
              <BookOpen size={16} />
              <span>{loading ? 'Seeding Problems...' : 'Seed 10 Problems Now'}</span>
            </button>
          )}

          {mode === 'ai' && (
            <button type="button" onClick={handleGenerateAI} disabled={loading} className="btn btn-primary">
              <Sparkles size={16} />
              <span>{loading ? 'Synthesizing Problems...' : 'Generate 10 Problems'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
