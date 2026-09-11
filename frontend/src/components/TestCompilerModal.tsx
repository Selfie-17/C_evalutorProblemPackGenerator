import React, { useState, useEffect, useRef } from 'react';
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
  Trash2,
  Zap,
  Sparkles,
  Sliders,
  ChevronRight,
  ShieldCheck,
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
  badge: string;
  name: string;
  tagline: string;
  code: string;
  stdin: string;
}

const PRESETS: PresetOption[] = [
  {
    id: 'hello',
    badge: '⚡ Basic',
    name: 'C11 Hello & Math',
    tagline: 'Standard I/O and integer arithmetic in GCC C11',
    code: `// C Lab Evaluation Platform — Compiler Verification Test
// Flags: -std=c11 -O2 -pipe
#include <stdio.h>

int main(void) {
    printf("=============================================\\n");
    printf("   C Compiler Sandbox Diagnostic Online\\n");
    printf("   Toolchain: GNU C11 Compiler (-O2)\\n");
    printf("=============================================\\n\\n");

    int a = 25, b = 17;
    int sum = a + b;
    int product = a * b;

    printf("[1] Addition Test:        %d + %d = %d\\n", a, b, sum);
    printf("[2] Multiplication Test:  %d * %d = %d\\n", a, b, product);
    printf("[3] Status:               GCC ENGINE OPERATIONAL ✔\\n");

    return 0;
}`,
    stdin: '',
  },
  {
    id: 'stdin',
    badge: '📥 Input',
    name: 'Interactive scanf()',
    tagline: 'Buffered standard input stream verification',
    code: `// Interactive Stdin Test
#include <stdio.h>

int main(void) {
    int x, y;
    printf("Waiting for standard input tokens (x, y)...\\n");

    if (scanf("%d %d", &x, &y) == 2) {
        printf("-> Successfully read inputs: x = %d, y = %d\\n", x, y);
        printf("-> Calculated Sum:     %d\\n", x + y);
        printf("-> Calculated Product: %d\\n", x * y);
    } else {
        fprintf(stderr, "Error: Failed to parse two integers from stdin.\\n");
        return 1;
    }

    return 0;
}`,
    stdin: '42 58',
  },
  {
    id: 'primes',
    badge: '🔄 Algorithm',
    name: 'Prime Sieve & Speed',
    tagline: 'Loop branching and CPU execution cycle check',
    code: `// Prime Number Sieve Benchmark
#include <stdio.h>
#include <stdbool.h>

bool is_prime(int n) {
    if (n <= 1) return false;
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) return false;
    }
    return true;
}

int main(void) {
    printf("Scanning prime integers up to 50:\\n");
    int count = 0;

    for (int i = 2; i <= 50; i++) {
        if (is_prime(i)) {
            printf("%d ", i);
            count++;
        }
    }

    printf("\\n\\n-> Total primes found: %d\\n", count);
    printf("-> Execution benchmark passed cleanly.\\n");
    return 0;
}`,
    stdin: '',
  },
  {
    id: 'syntax_error',
    badge: '⚠️ Diagnostics',
    name: 'Syntax Error Test',
    tagline: 'Verifies structured GCC diagnostic parser & line reporting',
    code: `// Intentional Syntax Error Test
#include <stdio.h>

int main(void) {
    // Missing semicolon on line below to trigger compiler diagnostic:
    int calculated_val = 100
    printf("Value: %d\\n", calculated_val);
    return 0;
}`,
    stdin: '',
  },
  {
    id: 'runtime_error',
    badge: '💥 Exception',
    name: 'Runtime Fault (SIGFPE)',
    tagline: 'Verifies process exit status and runtime signal trap',
    code: `// Intentional Runtime Exception Test
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    printf("Testing runtime exception signal handling...\\n");

    int numerator = 100;
    int denominator = 0;

    // Intentional division by zero causes SIGFPE:
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
  const [activeEditorTab, setActiveEditorTab] = useState<'code' | 'stdin'>('code');
  const [activeTerminalTab, setActiveTerminalTab] = useState<'stdout' | 'diagnostics' | 'raw'>('stdout');

  const [running, setRunning] = useState<boolean>(false);
  const [healthChecking, setHealthChecking] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthStatus | null>(initialHealth || null);
  const [result, setResult] = useState<RawExecuteCodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

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
      setResult(null);
      setError(null);
      if (p.stdin) {
        setActiveEditorTab('code');
      }
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

    try {
      const res = await executeRawCode(code, stdin, 5.0);
      setResult(res);
      setLastRunAt(new Date().toLocaleTimeString());

      // Auto-switch terminal tab to diagnostics if compilation error
      if (res.status === 'compilation_error') {
        setActiveTerminalTab('diagnostics');
      } else {
        setActiveTerminalTab('stdout');
      }
    } catch (err: any) {
      setError(err.message || 'Execution request failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleCopyOutput = () => {
    let textToCopy = '';
    if (activeTerminalTab === 'stdout') {
      textToCopy = result?.stdout || '';
    } else if (activeTerminalTab === 'diagnostics') {
      textToCopy = result?.compilation_output || '';
    } else {
      textToCopy = `${result?.compilation_output || ''}\n${result?.stdout || ''}\n${result?.stderr || ''}`;
    }

    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScrollSync = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode();
    }
  };

  const lines = code.split('\n');

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 120,
        backgroundColor: 'rgba(5, 8, 18, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          maxWidth: '1220px',
          width: '96vw',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0c1017',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 50px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'var(--font-sans)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* =================================================================== */}
        {/* 1. IDE TOP CHROME / WINDOW TITLEBAR                                 */}
        {/* =================================================================== */}
        <div
          style={{
            height: '46px',
            backgroundColor: '#090d14',
            borderBottom: '1px solid #1e2638',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            userSelect: 'none',
          }}
        >
          {/* Left: Window Traffic Lights & IDE Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            </div>

            <div style={{ height: '14px', width: '1px', backgroundColor: '#1e293b' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '5px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}
              >
                <Terminal size={13} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '-0.01em', color: '#f1f5f9' }}>
                C Compiler Studio
              </span>
              <span style={{ fontSize: '0.74rem', color: '#475569' }}>•</span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                main.c
              </span>
            </div>
          </div>

          {/* Center: Live Server Toolchain Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '3px 10px',
                borderRadius: '20px',
                backgroundColor: health?.gcc_available ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${health?.gcc_available ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                fontSize: '0.73rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: health?.gcc_available ? '#10b981' : '#ef4444',
                  boxShadow: health?.gcc_available ? '0 0 8px #10b981' : '0 0 8px #ef4444',
                }}
              />
              <span style={{ color: health?.gcc_available ? '#34d399' : '#f87171', fontWeight: 600 }}>
                {health?.gcc_available ? 'GCC Engine Online' : 'Compiler Offline'}
              </span>
              <span style={{ color: '#475569' }}>|</span>
              <span style={{ color: '#cbd5e1' }}>
                {health?.gcc_version ? health.gcc_version.split('\n')[0].replace('gcc (Debian ', 'gcc-').replace(')', '') : 'gcc 14.2'}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRefreshHealth}
              disabled={healthChecking}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Ping backend GCC health"
            >
              <RefreshCw size={12} className={healthChecking ? 'spin' : ''} />
              <span>Ping</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Close window"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. SUB-HEADER TOOLBAR: PRESET SELECTOR & COMPILER FLAGS             */}
        {/* =================================================================== */}
        <div
          style={{
            backgroundColor: '#101622',
            padding: '8px 16px',
            borderBottom: '1px solid #1e2638',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Presets Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
              Presets:
            </span>

            {PRESETS.map((preset) => {
              const isActive = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  style={{
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: isActive ? '#c7d2fe' : '#94a3b8',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  title={preset.tagline}
                >
                  <span>{preset.badge}</span>
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>

          {/* Compiler Flags Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                color: '#38bdf8',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              -std=c11 -O2 -pipe
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                color: '#a78bfa',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(167, 139, 250, 0.2)',
              }}
            >
              timeout: 5.0s
            </span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. MAIN WORKSPACE: SPLIT CODE EDITOR (LEFT) & TERMINAL (RIGHT)      */}
        {/* =================================================================== */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            minHeight: 0,
            backgroundColor: '#090d16',
          }}
        >
          {/* ----------------------------------------------------------------- */}
          {/* LEFT PANE: SOURCE CODE EDITOR & STDIN TABS                        */}
          {/* ----------------------------------------------------------------- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid #1e2638',
              backgroundColor: '#0b0f19',
              minHeight: 0,
            }}
          >
            {/* Editor File Tab Bar */}
            <div
              style={{
                height: '38px',
                backgroundColor: '#090d16',
                borderBottom: '1px solid #1e2638',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '2px' }}>
                {/* Tab: main.c */}
                <button
                  onClick={() => setActiveEditorTab('code')}
                  style={{
                    height: '100%',
                    backgroundColor: activeEditorTab === 'code' ? '#0b0f19' : 'transparent',
                    border: 'none',
                    borderBottom: activeEditorTab === 'code' ? '2px solid #6366f1' : '2px solid transparent',
                    borderTop: activeEditorTab === 'code' ? '1px solid #1e2638' : 'none',
                    color: activeEditorTab === 'code' ? '#f8fafc' : '#64748b',
                    padding: '0 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ color: '#60a5fa', fontWeight: 800 }}>C</span>
                  <span>main.c</span>
                </button>

                {/* Tab: stdin.txt */}
                <button
                  onClick={() => setActiveEditorTab('stdin')}
                  style={{
                    height: '100%',
                    backgroundColor: activeEditorTab === 'stdin' ? '#0b0f19' : 'transparent',
                    border: 'none',
                    borderBottom: activeEditorTab === 'stdin' ? '2px solid #6366f1' : '2px solid transparent',
                    borderTop: activeEditorTab === 'stdin' ? '1px solid #1e2638' : 'none',
                    color: activeEditorTab === 'stdin' ? '#f8fafc' : '#64748b',
                    padding: '0 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <FileText size={13} color={stdin ? '#38bdf8' : '#64748b'} />
                  <span>stdin.txt</span>
                  {stdin && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#38bdf8',
                      }}
                    />
                  )}
                </button>
              </div>

              {/* Editor Meta (Language & Encoding) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.7rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
                <span>{lines.length} lines</span>
                <span>•</span>
                <span>UTF-8</span>
                <span>•</span>
                <span style={{ color: '#818cf8' }}>C11</span>
              </div>
            </div>

            {/* Editor Workspace Area */}
            {activeEditorTab === 'code' ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#0b0f19',
                }}
              >
                {/* Line Numbers Gutter */}
                <div
                  ref={gutterRef}
                  style={{
                    width: '46px',
                    padding: '16px 8px 16px 0',
                    backgroundColor: '#080c14',
                    borderRight: '1px solid #1a2234',
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem',
                    lineHeight: '1.6',
                    color: '#334155',
                    userSelect: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>

                {/* Textarea Code Input */}
                <textarea
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onScroll={handleScrollSync}
                  spellCheck={false}
                  placeholder="#include <stdio.h>&#10;&#10;int main() {&#10;    printf(&quot;Hello, World!\\n&quot;);&#10;    return 0;&#10;}"
                  style={{
                    flex: 1,
                    height: '100%',
                    padding: '16px',
                    backgroundColor: 'transparent',
                    color: '#f8fafc',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.83rem',
                    lineHeight: '1.6',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    tabSize: 4,
                    whiteSpace: 'pre',
                    overflowWrap: 'normal',
                    overflowX: 'auto',
                  }}
                />
              </div>
            ) : (
              /* Stdin Input Editor Tab */
              <div
                style={{
                  flex: 1,
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: '#0b0f19',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
                      Standard Input (stdin)
                    </h4>
                    <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0 0' }}>
                      Input passed to the binary process when calling scanf(), getchar(), or fgets().
                    </p>
                  </div>
                  {stdin && (
                    <button
                      onClick={() => setStdin('')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Clear Stdin</span>
                    </button>
                  )}
                </div>

                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter inputs here (e.g. numbers, strings, multiple lines)..."
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: '14px',
                    backgroundColor: '#070a12',
                    border: '1px solid #1e2638',
                    borderRadius: '8px',
                    color: '#38bdf8',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.84rem',
                    lineHeight: '1.6',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* RIGHT PANE: REAL TERMINAL & COMPILER OUTPUT                       */}
          {/* ----------------------------------------------------------------- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#070a12',
              minHeight: 0,
            }}
          >
            {/* Terminal Tab Bar */}
            <div
              style={{
                height: '38px',
                backgroundColor: '#090d16',
                borderBottom: '1px solid #1e2638',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setActiveTerminalTab('stdout')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTerminalTab === 'stdout' ? '2px solid #10b981' : '2px solid transparent',
                    color: activeTerminalTab === 'stdout' ? '#f8fafc' : '#64748b',
                    padding: '8px 12px',
                    fontSize: '0.76rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Terminal size={13} color={activeTerminalTab === 'stdout' ? '#10b981' : '#64748b'} />
                  <span>stdout</span>
                </button>

                <button
                  onClick={() => setActiveTerminalTab('diagnostics')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTerminalTab === 'diagnostics' ? '2px solid #ef4444' : '2px solid transparent',
                    color: activeTerminalTab === 'diagnostics' ? '#f8fafc' : '#64748b',
                    padding: '8px 12px',
                    fontSize: '0.76rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertTriangle size={13} color={result?.compilation_output ? '#ef4444' : '#64748b'} />
                  <span>Diagnostics</span>
                  {result?.compilation_output && (
                    <span
                      style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '0.62rem',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontWeight: 700,
                      }}
                    >
                      !
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTerminalTab('raw')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTerminalTab === 'raw' ? '2px solid #6366f1' : '2px solid transparent',
                    color: activeTerminalTab === 'raw' ? '#f8fafc' : '#64748b',
                    padding: '8px 12px',
                    fontSize: '0.76rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>Build Log</span>
                </button>
              </div>

              {/* Status & Copy Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {result && (
                  <button
                    onClick={handleCopyOutput}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Copy terminal content"
                  >
                    {copied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Terminal Output Screen */}
            <div
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: '1.6',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Shell Execution Command Simulation Header */}
              <div
                style={{
                  color: '#475569',
                  borderBottom: '1px solid #141b2b',
                  paddingBottom: '10px',
                  marginBottom: '12px',
                  fontSize: '0.75rem',
                }}
              >
                <div>$ gcc -std=c11 -O2 -pipe main.c -o /tmp/sandbox_bin</div>
                {stdin && <div>$ /tmp/sandbox_bin &lt; stdin.txt</div>}
                {!stdin && <div>$ /tmp/sandbox_bin</div>}
              </div>

              {/* Loading State */}
              {running && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                    gap: '12px',
                  }}
                >
                  <RefreshCw size={32} className="spin" />
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Compiling with GCC 14.2...</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Invoking Linux compiler sandbox & linking binary
                  </div>
                </div>
              )}

              {/* Network or Gateway Error */}
              {error && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px' }}>Execution Error:</strong>
                    <div style={{ wordBreak: 'break-word', color: '#fca5a5' }}>{error}</div>
                  </div>
                </div>
              )}

              {/* Idle Empty State */}
              {!result && !running && !error && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#334155',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '14px',
                      color: '#475569',
                    }}
                  >
                    <Terminal size={24} />
                  </div>
                  <div style={{ fontWeight: 600, color: '#64748b', fontSize: '0.88rem' }}>
                    Awaiting Code Compilation
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#475569', maxWidth: '300px', marginTop: '6px', lineHeight: 1.5 }}>
                    Click <strong style={{ color: '#818cf8' }}>"Compile & Run"</strong> or press <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1' }}>Ctrl+Enter</kbd> to build and execute.
                  </p>
                </div>
              )}

              {/* Result: STDOUT View */}
              {result && activeTerminalTab === 'stdout' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      flex: 1,
                      color: result.status === 'success' ? '#34d399' : '#f87171',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {result.stdout || (
                      <span style={{ color: '#475569', fontStyle: 'italic' }}>
                        [Program completed without writing to standard output]
                      </span>
                    )}
                  </div>

                  {result.stderr && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '10px 12px',
                        backgroundColor: 'rgba(249, 115, 22, 0.08)',
                        borderLeft: '3px solid #f97316',
                        color: '#fb923c',
                        borderRadius: '0 6px 6px 0',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>Standard Error (stderr):</div>
                      <div>{result.stderr}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Result: DIAGNOSTICS View */}
              {result && activeTerminalTab === 'diagnostics' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {result.compilation_output ? (
                    <div
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        padding: '14px',
                        color: '#fca5a5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.5,
                      }}
                    >
                      {result.compilation_output}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '30px',
                        textAlign: 'center',
                        color: '#10b981',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <CheckCircle2 size={28} />
                      <div style={{ fontWeight: 700 }}>Clean Build — Zero Compiler Warnings or Errors</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        GCC compiled source file main.c without diagnostics.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Result: RAW BUILD LOG View */}
              {result && activeTerminalTab === 'raw' && (
                <div
                  style={{
                    flex: 1,
                    color: '#94a3b8',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ color: '#818cf8', marginBottom: '8px' }}>
                    --- [EXECUTION REPORT] ---
                  </div>
                  <div>Status:         {result.status.toUpperCase()}</div>
                  <div>Exit Code:      {result.exit_code !== null && result.exit_code !== undefined ? result.exit_code : 'N/A'}</div>
                  <div>Execution Time: {result.execution_time_ms.toFixed(2)} ms</div>
                  <div style={{ margin: '8px 0', borderBottom: '1px solid #1e2638' }} />
                  <div style={{ color: '#818cf8', marginBottom: '8px' }}>--- [COMPILER OUTPUT] ---</div>
                  <div>{result.compilation_output || '(Empty)'}</div>
                  <div style={{ margin: '8px 0', borderBottom: '1px solid #1e2638' }} />
                  <div style={{ color: '#818cf8', marginBottom: '8px' }}>--- [STDOUT] ---</div>
                  <div>{result.stdout || '(Empty)'}</div>
                </div>
              )}

              {/* Terminal Exit Footer (when result exists) */}
              {result && (
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid #141b2b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    color: '#64748b',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {result.status === 'success' ? (
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✔ Process completed (exit 0)</span>
                    ) : result.status === 'compilation_error' ? (
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>✖ Build Failed (compilation error)</span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>⚠ Process exited (exit {result.exit_code})</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>Runtime: <strong style={{ color: '#cbd5e1' }}>{result.execution_time_ms.toFixed(1)} ms</strong></span>
                    {lastRunAt && <span>Run at {lastRunAt}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. IDE STATUS BAR & RUN LAUNCHER FOOTER                             */}
        {/* =================================================================== */}
        <div
          style={{
            height: '52px',
            backgroundColor: '#090d14',
            borderTop: '1px solid #1e2638',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          {/* Status Metrics on the left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.76rem', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="#6366f1" />
              <span>GCC 14.2 (Linux x86_64)</span>
            </span>

            <span>•</span>

            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#10b981" />
              <span>Sandboxed Execution</span>
            </span>

            {result && (
              <>
                <span>•</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      result.status === 'success'
                        ? '#10b981'
                        : result.status === 'compilation_error'
                        ? '#ef4444'
                        : '#f59e0b',
                  }}
                >
                  {result.status.toUpperCase().replace('_', ' ')} ({result.execution_time_ms.toFixed(1)}ms)
                </span>
              </>
            )}
          </div>

          {/* Action buttons on the right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => handleSelectPreset(selectedPreset)}
              disabled={running}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Reset Code
            </button>

            <button
              onClick={handleRunCode}
              disabled={running}
              style={{
                background: running
                  ? '#312e81'
                  : 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '8px 22px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: running ? 'not-allowed' : 'pointer',
                boxShadow: running
                  ? 'none'
                  : '0 4px 16px rgba(79, 70, 229, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
                transition: 'all 0.15s ease',
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
                  <kbd
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    Ctrl+Enter
                  </kbd>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
