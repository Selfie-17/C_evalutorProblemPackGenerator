import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  Code2,
  FileText,
} from 'lucide-react';
import { executeRawCode, fetchHealth } from '../services/api';
import { HealthStatus, RawExecuteCodeResponse } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialHealth?: HealthStatus | null;
}

interface PresetOption {
  id: string;
  name: string;
  description: string;
  code: string;
  stdin: string;
}

const PRESETS: PresetOption[] = [
  {
    id: 'hello',
    name: '1. Hello World & Math',
    description: 'Verify C11 compilation and basic integer arithmetic',
    code: `#include <stdio.h>

int main() {
    printf("=========================================\\n");
    printf(" C Compiler Diagnostic & Sandbox Test\\n");
    printf(" Standard: C11 (-std=c11 -O2 -pipe)\\n");
    printf("=========================================\\n\\n");
    
    int a = 25, b = 17;
    printf("Math Check: %d + %d = %d\\n", a, b, a + b);
    printf("Compiler Status: SUCCESS (Operational)\\n");
    return 0;
}`,
    stdin: '',
  },
  {
    id: 'stdin',
    name: '2. Standard Input (scanf)',
    description: 'Test interactive stdin buffering and multi-value scanning',
    code: `#include <stdio.h>

int main() {
    int x, y;
    printf("Reading two integers from standard input...\\n");
    if (scanf("%d %d", &x, &y) == 2) {
        printf("Received: x = %d, y = %d\\n", x, y);
        printf("Sum: %d\\n", x + y);
        printf("Product: %d\\n", x * y);
    } else {
        printf("Error: Could not read two integers from input.\\n");
        return 1;
    }
    return 0;
}`,
    stdin: '42 58',
  },
  {
    id: 'primes',
    name: '3. Loops & Algorithms',
    description: 'Calculate prime numbers to verify CPU execution speed',
    code: `#include <stdio.h>

int is_prime(int n) {
    if (n <= 1) return 0;
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) return 0;
    }
    return 1;
}

int main() {
    printf("Prime numbers up to 50:\\n");
    int count = 0;
    for (int i = 2; i <= 50; i++) {
        if (is_prime(i)) {
            printf("%d ", i);
            count++;
        }
    }
    printf("\\nTotal primes found: %d\\n", count);
    return 0;
}`,
    stdin: '',
  },
  {
    id: 'syntax_error',
    name: '4. Syntax Error Test',
    description: 'Test compiler diagnostic parser with an intentional error',
    code: `#include <stdio.h>

int main() {
    // Intentional missing semicolon below:
    int number = 42
    printf("Value: %d\\n", number);
    return 0;
}`,
    stdin: '',
  },
  {
    id: 'runtime_error',
    name: '5. Runtime Error Test',
    description: 'Test exception capture with intentional division by zero',
    code: `#include <stdio.h>

int main() {
    printf("Testing runtime exception handling...\\n");
    int numerator = 100;
    int denominator = 0;
    // Division by zero causes SIGFPE runtime fault:
    int result = numerator / denominator;
    printf("Result = %d\\n", result);
    return 0;
}`,
    stdin: '',
  },
];

export const TestCompilerModal: React.FC<Props> = ({ isOpen, onClose, initialHealth }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('hello');
  const [code, setCode] = useState<string>(PRESETS[0].code);
  const [stdin, setStdin] = useState<string>(PRESETS[0].stdin);
  const [running, setRunning] = useState<boolean>(false);
  const [healthChecking, setHealthChecking] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthStatus | null>(initialHealth || null);
  const [result, setResult] = useState<RawExecuteCodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showStdin, setShowStdin] = useState<boolean>(false);

  useEffect(() => {
    if (initialHealth) {
      setHealth(initialHealth);
    }
  }, [initialHealth]);

  useEffect(() => {
    if (isOpen && !health) {
      handleRefreshHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      setCode(p.code);
      setStdin(p.stdin);
      if (p.stdin) setShowStdin(true);
      setResult(null);
      setError(null);
    }
  };

  const handleRefreshHealth = async () => {
    setHealthChecking(true);
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (err: any) {
      console.error('Failed to fetch compiler health:', err);
    } finally {
      setHealthChecking(false);
    }
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      setError('Please provide C code to compile.');
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await executeRawCode(code, stdin, 5.0);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Execution request failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleCopyOutput = () => {
    const textToCopy = result?.stdout || result?.compilation_output || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 120 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '960px',
          width: '95vw',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 24px',
            backgroundColor: '#0f172a',
            color: 'white',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Terminal size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  C Compiler Live Test & Diagnostic Sandbox
                </h3>
                {health && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: health.gcc_available ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: health.gcc_available ? '#34d399' : '#f87171',
                      border: `1px solid ${health.gcc_available ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {health.gcc_available ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {health.gcc_available ? 'GCC Active' : 'Compiler Offline'}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Compile and execute arbitrary C code directly via server GCC toolchain
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRefreshHealth}
              disabled={healthChecking}
              className="btn btn-secondary btn-sm"
              title="Ping backend compiler health"
              style={{
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                borderColor: '#334155',
                fontSize: '0.76rem',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={13} className={healthChecking ? 'spin' : ''} />
              <span>Ping Status</span>
            </button>

            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                borderColor: '#334155',
                padding: '6px 8px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Compiler System Info Ribbon */}
        <div
          style={{
            backgroundColor: '#1e293b',
            padding: '8px 24px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#94a3b8',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={13} color="#818cf8" />
              <span>GCC Path: <strong style={{ color: '#e2e8f0' }}>{health?.gcc_path || 'gcc'}</strong></span>
            </span>
            <span>
              Flags: <strong style={{ color: '#e2e8f0' }}>-std=c11 -O2 -pipe</strong>
            </span>
          </div>

          <div>
            <span>Version: <strong style={{ color: '#e2e8f0' }}>{health?.gcc_version ? health.gcc_version.split('\n')[0] : 'Detecting...'}</strong></span>
          </div>
        </div>

        {/* Preset Selector Bar */}
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Quick Presets:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                style={{
                  fontSize: '0.76rem',
                  fontWeight: selectedPreset === preset.id ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${selectedPreset === preset.id ? '#4f46e5' : '#cbd5e1'}`,
                  backgroundColor: selectedPreset === preset.id ? '#eef2ff' : '#ffffff',
                  color: selectedPreset === preset.id ? '#4338ca' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowStdin(!showStdin)}
              style={{
                fontSize: '0.76rem',
                fontWeight: 600,
                color: showStdin ? '#4f46e5' : '#64748b',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FileText size={14} />
              <span>{showStdin ? 'Hide Stdin' : 'Custom Stdin'} {stdin ? '●' : ''}</span>
            </button>
          </div>
        </div>

        {/* Modal Body: Split Editor & Output */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            overflow: 'hidden',
          }}
        >
          {/* Left Column: Code Editor & Stdin */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={14} color="#4f46e5" />
                <span>C Source Code (main.c)</span>
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Press <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1' }}>Ctrl+Enter</kbd> to run
              </span>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="#include <stdio.h>&#10;&#10;int main() {&#10;    printf(&quot;Hello, World!\\n&quot;);&#10;    return 0;&#10;}"
              spellCheck={false}
              style={{
                flex: 1,
                width: '100%',
                padding: '16px',
                fontSize: '0.86rem',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
                border: 'none',
                outline: 'none',
                resize: 'none',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                tabSize: 4,
              }}
            />

            {/* Optional Stdin Drawer */}
            {showStdin && (
              <div
                style={{
                  borderTop: '2px solid #334155',
                  backgroundColor: '#1e293b',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8' }}>
                    Standard Input (stdin) passed to executable:
                  </span>
                  <button
                    onClick={() => setStdin('')}
                    style={{ fontSize: '0.7rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Clear Stdin
                  </button>
                </div>
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Input numbers, text, or tokens for scanf()..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#0f172a',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Execution Output & Diagnostics */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f8fafc',
              overflow: 'hidden',
            }}
          >
            {/* Output Header */}
            <div
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  Execution Results & Diagnostics
                </span>
                {result && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor:
                        result.status === 'success'
                          ? '#ecfdf5'
                          : result.status === 'compilation_error'
                          ? '#fff1f2'
                          : '#fff7ed',
                      color:
                        result.status === 'success'
                          ? '#065f46'
                          : result.status === 'compilation_error'
                          ? '#9f1239'
                          : '#9a3412',
                      border: `1px solid ${
                        result.status === 'success'
                          ? '#a7f3d0'
                          : result.status === 'compilation_error'
                          ? '#fecdd3'
                          : '#fed7aa'
                      }`,
                    }}
                  >
                    {result.status.toUpperCase().replace('_', ' ')}
                  </span>
                )}
              </div>

              {result && (
                <button
                  onClick={handleCopyOutput}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: '#475569',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  title="Copy terminal output"
                >
                  {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            {/* Results Content Area */}
            <div
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {error && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderLeft: '4px solid #ef4444',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#991b1b',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <XCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong>Execution Error:</strong>
                    <div style={{ marginTop: '2px', wordBreak: 'break-word' }}>{error}</div>
                  </div>
                </div>
              )}

              {!result && !running && !error && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    textAlign: 'center',
                    padding: '24px',
                  }}
                >
                  <Terminal size={42} strokeWidth={1.5} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                  <div style={{ fontWeight: 600, color: '#64748b', fontSize: '0.95rem' }}>
                    Ready to Test Compiler
                  </div>
                  <p style={{ fontSize: '0.82rem', maxWidth: '280px', marginTop: '4px' }}>
                    Select a preset or edit the C code on the left, then click <strong>"Compile & Run"</strong> below.
                  </p>
                </div>
              )}

              {running && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4f46e5',
                  }}
                >
                  <RefreshCw size={36} className="spin" style={{ marginBottom: '12px' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Compiling with GCC...</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                    Running in secure sandbox (-std=c11 -O2)
                  </div>
                </div>
              )}

              {result && (
                <>
                  {/* Summary Metric Strip */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Verdict</div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color:
                            result.status === 'success'
                              ? '#059669'
                              : result.status === 'compilation_error'
                              ? '#dc2626'
                              : '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '2px',
                        }}
                      >
                        {result.status === 'success' ? (
                          <CheckCircle2 size={14} />
                        ) : result.status === 'compilation_error' ? (
                          <XCircle size={14} />
                        ) : (
                          <AlertTriangle size={14} />
                        )}
                        <span>{result.status.toUpperCase()}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Execution Time</div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '2px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <Clock size={13} color="#64748b" />
                        <span>{result.execution_time_ms.toFixed(1)} ms</span>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Exit Code</div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: result.exit_code === 0 ? '#059669' : '#dc2626',
                          marginTop: '2px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {result.exit_code !== null && result.exit_code !== undefined ? result.exit_code : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Standard Output Console */}
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Standard Output (stdout):
                    </div>
                    <div
                      style={{
                        backgroundColor: '#0f172a',
                        color: '#34d399',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        minHeight: '80px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        border: '1px solid #1e293b',
                      }}
                    >
                      {result.stdout || <span style={{ color: '#64748b' }}>[No output generated]</span>}
                    </div>
                  </div>

                  {/* Compilation Output & Diagnostics (if any) */}
                  {result.compilation_output && (
                    <div>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: result.status === 'compilation_error' ? '#9f1239' : '#475569',
                          marginBottom: '6px',
                        }}
                      >
                        Compiler Output & Diagnostics:
                      </div>
                      <div
                        style={{
                          backgroundColor: result.status === 'compilation_error' ? '#fff1f2' : '#f1f5f9',
                          color: result.status === 'compilation_error' ? '#9f1239' : '#334155',
                          border: `1px solid ${result.status === 'compilation_error' ? '#fecdd3' : '#e2e8f0'}`,
                          padding: '12px 14px',
                          borderRadius: '8px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          lineHeight: 1.5,
                          maxHeight: '200px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {result.compilation_output}
                      </div>
                    </div>
                  )}

                  {/* Stderr (if any) */}
                  {result.stderr && (
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#9a3412', marginBottom: '6px' }}>
                        Standard Error (stderr):
                      </div>
                      <div
                        style={{
                          backgroundColor: '#fff7ed',
                          color: '#9a3412',
                          border: '1px solid #fed7aa',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {result.stderr}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 24px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#64748b' }}>
            <span>Preset: <strong>{PRESETS.find((x) => x.id === selectedPreset)?.name}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => handleSelectPreset(selectedPreset)}
              disabled={running}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 14px' }}
            >
              Reset Code
            </button>

            <button
              onClick={handleRunCode}
              disabled={running}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                fontWeight: 600,
              }}
            >
              {running ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Compiling...</span>
                </>
              ) : (
                <>
                  <Play size={15} fill="currentColor" />
                  <span>Compile & Run</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
