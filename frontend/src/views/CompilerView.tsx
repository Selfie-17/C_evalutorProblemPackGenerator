import React, { useState, useEffect, useRef } from 'react';
import {
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
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { executeRawCode, fetchHealth } from '../services/api';
import { HealthStatus, RawExecuteCodeResponse } from '../types';

interface Props {
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
    name: 'C11 Hello & Arithmetic',
    tagline: 'Standard I/O and integer arithmetic in GCC C11',
    code: `// C Lab Evaluation Platform — Compiler Verification Test
// Toolchain Flags: -std=c11 -O2 -pipe
#include <stdio.h>

int main(void) {
    printf("=============================================\\n");
    printf("   C Compiler Sandbox Diagnostic Online\\n");
    printf("   Standard: GNU C11 (-std=c11 -O2 -pipe)\\n");
    printf("=============================================\\n\\n");

    int a = 25, b = 17;
    int sum = a + b;
    int product = a * b;

    printf("[1] Addition Check:       %d + %d = %d\\n", a, b, sum);
    printf("[2] Multiplication Check: %d * %d = %d\\n", a, b, product);
    printf("[3] Toolchain Status:     GCC ENGINE OPERATIONAL ✔\\n");

    return 0;
}`,
    stdin: '',
  },
  {
    id: 'stdin',
    badge: '📥 Input',
    name: 'Interactive Input (scanf)',
    tagline: 'Buffered standard input stream verification',
    code: `// Interactive Stdin Verification
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
    tagline: 'Loop branching and CPU execution cycle benchmark',
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
    printf("-> Benchmark completed successfully.\\n");
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

export const CompilerView: React.FC<Props> = ({ initialHealth }) => {
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
    if (!health) {
      handleRefreshHealth();
    }
  }, []);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      setCode(p.code);
      setStdin(p.stdin);
      setResult(null);
      setError(null);
      setActiveEditorTab('code');
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
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        paddingBottom: '24px',
      }}
    >
      {/* =================================================================== */}
      {/* 1. TOP PAGE BANNER: TITLE, STATUS & COMPILER SPECS (LIGHT THEME)    */}
      {/* =================================================================== */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#eef2ff',
              border: '1px solid #c7d2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4f46e5',
            }}
          >
            <Terminal size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                C Compiler Playground & Diagnostic Studio
              </h2>
              {health && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    backgroundColor: health.gcc_available ? '#ecfdf5' : '#fef2f2',
                    color: health.gcc_available ? '#065f46' : '#991b1b',
                    border: `1px solid ${health.gcc_available ? '#a7f3d0' : '#fecaca'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: health.gcc_available ? '#10b981' : '#ef4444',
                    }}
                  />
                  <span>{health.gcc_available ? 'GCC Active' : 'Compiler Offline'}</span>
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Live server GCC toolchain sandbox for testing C11 compilation, standard input, and runtime performance.
            </p>
          </div>
        </div>

        {/* Toolchain Specs & Health Ping */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              color: '#475569',
            }}
          >
            <Cpu size={14} color="#4f46e5" />
            <span>
              GCC: <strong style={{ color: '#0f172a' }}>{health?.gcc_version ? health.gcc_version.split('\n')[0].replace('gcc (Debian ', '').replace(')', '') : 'gcc 14.2'}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#4f46e5', fontWeight: 600 }}>-std=c11 -O2</span>
          </div>

          <button
            onClick={handleRefreshHealth}
            disabled={healthChecking}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              padding: '7px 12px',
            }}
            title="Ping backend compiler health"
          >
            <RefreshCw size={13} className={healthChecking ? 'spin' : ''} />
            <span>Ping Status</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. PRESET CHIP SELECTOR BAR (LIGHT SAAS STYLE)                      */}
      {/* =================================================================== */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '12px 18px',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginRight: '4px',
            }}
          >
            Quick Presets:
          </span>

          {PRESETS.map((preset) => {
            const isActive = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                style={{
                  backgroundColor: isActive ? '#eef2ff' : '#ffffff',
                  border: `1px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                  color: isActive ? '#4338ca' : '#475569',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isActive ? '0 1px 2px rgba(79, 70, 229, 0.1)' : 'none',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} color="#059669" />
            <span>Isolated Linux Sandbox</span>
          </span>
          <span>•</span>
          <span>5.0s Timeout</span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. MAIN COMPILER WORKSPACE (FULL-WIDTH 2-COLUMN LIGHT IDE)          */}
      {/* =================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr',
          gap: '20px',
          minHeight: '560px',
        }}
      >
        {/* ----------------------------------------------------------------- */}
        {/* LEFT COLUMN: LIGHT THEME CODE EDITOR                              */}
        {/* ----------------------------------------------------------------- */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Editor Tabs Header */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '0 8px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '2px' }}>
              {/* Tab: main.c */}
              <button
                onClick={() => setActiveEditorTab('code')}
                style={{
                  height: '100%',
                  backgroundColor: activeEditorTab === 'code' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom: activeEditorTab === 'code' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeEditorTab === 'code' ? '#0f172a' : '#64748b',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    backgroundColor: '#e0e7ff',
                    color: '#4338ca',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  C
                </div>
                <span>main.c</span>
              </button>

              {/* Tab: stdin.txt */}
              <button
                onClick={() => setActiveEditorTab('stdin')}
                style={{
                  height: '100%',
                  backgroundColor: activeEditorTab === 'stdin' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom: activeEditorTab === 'stdin' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeEditorTab === 'stdin' ? '#0f172a' : '#64748b',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FileText size={14} color={stdin ? '#0284c7' : '#94a3b8'} />
                <span>stdin.txt</span>
                {stdin && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#0284c7',
                    }}
                  />
                )}
              </button>
            </div>

            {/* File metadata */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              <span>{lines.length} lines</span>
              <span>•</span>
              <span>UTF-8</span>
              <span>•</span>
              <span style={{ color: '#4f46e5', fontWeight: 600 }}>C11</span>
            </div>
          </div>

          {/* Editor Body Area */}
          {activeEditorTab === 'code' ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: '#ffffff',
                minHeight: '440px',
              }}
            >
              {/* Line Numbers Gutter */}
              <div
                ref={gutterRef}
                style={{
                  width: '46px',
                  padding: '16px 8px 16px 0',
                  backgroundColor: '#f8fafc',
                  borderRight: '1px solid #e2e8f0',
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.84rem',
                  lineHeight: '1.6',
                  color: '#94a3b8',
                  userSelect: 'none',
                  overflow: 'hidden',
                }}
              >
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Code Textarea */}
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
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
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
            /* Stdin Tab Editor */
            <div
              style={{
                flex: 1,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: '#ffffff',
                minHeight: '440px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Standard Input (stdin.txt)
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Data streamed to the program stdin when calling scanf(), getchar(), or fgets().
                  </p>
                </div>
                {stdin && (
                  <button
                    onClick={() => setStdin('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Clear Stdin</span>
                  </button>
                )}
              </div>

              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter numbers or text here (e.g. 42 58)..."
                style={{
                  flex: 1,
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#0f172a',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  outline: 'none',
                  resize: 'none',
                }}
              />
            </div>
          )}

          {/* Editor Sub-Footer / Controls */}
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#64748b' }}>
              <span>Shortcut:</span>
              <kbd
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                Ctrl+Enter
              </kbd>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => handleSelectPreset(selectedPreset)}
                disabled={running}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Reset code to original preset"
              >
                <RotateCcw size={13} />
                <span>Reset Code</span>
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
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  backgroundColor: '#4f46e5',
                  borderColor: '#4338ca',
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

        {/* ----------------------------------------------------------------- */}
        {/* RIGHT COLUMN: LIGHT THEME COMPILER OUTPUT & DIAGNOSTICS           */}
        {/* ----------------------------------------------------------------- */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Terminal Tabs Header */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '0 8px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '2px' }}>
              <button
                onClick={() => setActiveTerminalTab('stdout')}
                style={{
                  height: '100%',
                  backgroundColor: activeTerminalTab === 'stdout' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom: activeTerminalTab === 'stdout' ? '2px solid #059669' : '2px solid transparent',
                  color: activeTerminalTab === 'stdout' ? '#0f172a' : '#64748b',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Terminal size={14} color={activeTerminalTab === 'stdout' ? '#059669' : '#64748b'} />
                <span>Standard Output</span>
              </button>

              <button
                onClick={() => setActiveTerminalTab('diagnostics')}
                style={{
                  height: '100%',
                  backgroundColor: activeTerminalTab === 'diagnostics' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom: activeTerminalTab === 'diagnostics' ? '2px solid #dc2626' : '2px solid transparent',
                  color: activeTerminalTab === 'diagnostics' ? '#0f172a' : '#64748b',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <AlertTriangle size={14} color={result?.compilation_output ? '#dc2626' : '#64748b'} />
                <span>Diagnostics</span>
                {result?.compilation_output && (
                  <span
                    style={{
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      fontSize: '0.68rem',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700,
                    }}
                  >
                    Error
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTerminalTab('raw')}
                style={{
                  height: '100%',
                  backgroundColor: activeTerminalTab === 'raw' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom: activeTerminalTab === 'raw' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeTerminalTab === 'raw' ? '#0f172a' : '#64748b',
                  padding: '0 16px',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>Build Log</span>
              </button>
            </div>

            {/* Copy Button */}
            {result && (
              <button
                onClick={handleCopyOutput}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.72rem' }}
                title="Copy output"
              >
                {copied ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          {/* Terminal Content Box */}
          <div
            style={{
              flex: 1,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f8fafc',
              minHeight: '440px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {/* Simulated Shell Header */}
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                paddingBottom: '10px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '14px',
              }}
            >
              <div>$ gcc -std=c11 -O2 -pipe main.c -o solution</div>
              {stdin && <div>$ ./solution &lt; stdin.txt</div>}
              {!stdin && <div>$ ./solution</div>}
            </div>

            {/* Compiling spinner */}
            {running && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4f46e5',
                  gap: '12px',
                }}
              >
                <RefreshCw size={36} className="spin" />
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Compiling with GCC...</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Running in secure Linux sandbox (-std=c11 -O2 -pipe)
                </div>
              </div>
            )}

            {/* Network / Gateway Error */}
            {error && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderLeft: '4px solid #ef4444',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <XCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>Execution Error:</strong>
                  <div style={{ wordBreak: 'break-word', color: '#b91c1c' }}>{error}</div>
                </div>
              </div>
            )}

            {/* Awaiting compilation state */}
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
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    backgroundColor: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4f46e5',
                    marginBottom: '14px',
                  }}
                >
                  <Terminal size={26} />
                </div>
                <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem' }}>
                  Ready to Compile & Run
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '320px', marginTop: '6px', lineHeight: 1.5 }}>
                  Select a preset on the left or write your own C code, then click <strong style={{ color: '#4f46e5' }}>"Compile & Run"</strong>.
                </p>
              </div>
            )}

            {/* Result: STDOUT */}
            {result && activeTerminalTab === 'stdout' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Result Card Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: result.status === 'success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${result.status === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    borderRadius: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.status === 'success' ? (
                      <CheckCircle2 size={16} color="#059669" />
                    ) : (
                      <XCircle size={16} color="#dc2626" />
                    )}
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: result.status === 'success' ? '#065f46' : '#991b1b',
                      }}
                    >
                      {result.status === 'success' ? 'COMPILE & EXECUTION SUCCESS' : result.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem' }}>
                    <span style={{ color: '#475569' }}>
                      Exit: <strong>{result.exit_code !== null ? result.exit_code : 'N/A'}</strong>
                    </span>
                    <span style={{ color: '#475569' }}>
                      Time: <strong>{result.execution_time_ms.toFixed(1)} ms</strong>
                    </span>
                  </div>
                </div>

                {/* Stdout block */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '0.84rem',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#0f172a',
                  }}
                >
                  {result.stdout || (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      [Program terminated without writing to standard output]
                    </span>
                  )}
                </div>

                {result.stderr && (
                  <div
                    style={{
                      marginTop: '12px',
                      backgroundColor: '#fff7ed',
                      border: '1px solid #fed7aa',
                      borderLeft: '4px solid #f97316',
                      borderRadius: '6px',
                      padding: '12px 14px',
                      fontSize: '0.8rem',
                      color: '#9a3412',
                    }}
                  >
                    <strong>Standard Error (stderr):</strong>
                    <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{result.stderr}</div>
                  </div>
                )}
              </div>
            )}

            {/* Result: DIAGNOSTICS */}
            {result && activeTerminalTab === 'diagnostics' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {result.compilation_output ? (
                  <div
                    style={{
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderLeft: '4px solid #e11d48',
                      borderRadius: '8px',
                      padding: '16px',
                      color: '#9f1239',
                      fontSize: '0.82rem',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={15} color="#e11d48" />
                      <span>GCC Compiler Diagnostics & Errors:</span>
                    </div>
                    <div>{result.compilation_output}</div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#059669',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={32} />
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Clean Compilation</div>
                    <div style={{ fontSize: '0.78rem', color: '#065f46' }}>
                      GCC compiled source file main.c with zero warnings or errors.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Result: BUILD LOG */}
            {result && activeTerminalTab === 'raw' && (
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '0.8rem',
                  lineHeight: '1.6',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <div style={{ color: '#4f46e5', fontWeight: 700, marginBottom: '8px' }}>
                  === EXECUTION SUMMARY REPORT ===
                </div>
                <div>Status:           {result.status.toUpperCase()}</div>
                <div>Exit Code:        {result.exit_code !== null ? result.exit_code : 'N/A'}</div>
                <div>Execution Time:   {result.execution_time_ms.toFixed(2)} ms</div>
                <div>Timestamp:        {lastRunAt || 'N/A'}</div>
                <div style={{ margin: '10px 0', borderBottom: '1px solid #e2e8f0' }} />
                <div style={{ color: '#4f46e5', fontWeight: 700, marginBottom: '6px' }}>=== COMPILER OUTPUT ===</div>
                <div>{result.compilation_output || '(Clean compilation)'}</div>
                <div style={{ margin: '10px 0', borderBottom: '1px solid #e2e8f0' }} />
                <div style={{ color: '#4f46e5', fontWeight: 700, marginBottom: '6px' }}>=== STDOUT ===</div>
                <div>{result.stdout || '(Empty)'}</div>
              </div>
            )}

            {/* Execution Footer Info */}
            {result && (
              <div
                style={{
                  marginTop: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.74rem',
                  color: '#64748b',
                }}
              >
                <span>
                  Preset: <strong>{PRESETS.find((p) => p.id === selectedPreset)?.name}</strong>
                </span>
                {lastRunAt && <span>Last executed at {lastRunAt}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
