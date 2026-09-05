import React, { useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react';
import { CompilationDiagnostic, CompilationResult } from '../types';
import { CodeViewer } from './CodeViewer';

interface Props {
  compilation: CompilationResult;
  sourceCode: string;
}

export const CompilationErrorViewer: React.FC<Props> = ({ compilation, sourceCode }) => {
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const errors = compilation.errors || [];
  const errorLines = errors
    .map((e) => e.line)
    .filter((l): l is number => typeof l === 'number');

  const copyRaw = () => {
    navigator.clipboard.writeText(compilation.compiler_output);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="compilation-error-card">
      <div className="compilation-error-header">
        <AlertOctagon size={20} color="#e11d48" />
        <span>Compilation Diagnostics ({errors.length} {errors.length === 1 ? 'Error' : 'Errors'} Detected)</span>
      </div>

      {/* Structured Diagnostics List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
        {errors.map((err: CompilationDiagnostic, idx: number) => (
          <div
            key={idx}
            style={{
              backgroundColor: 'white',
              border: '1px solid var(--ce-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {err.line && (
                <span
                  style={{
                    backgroundColor: '#ffe4e6',
                    color: '#9f1239',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Line {err.line}{err.column ? ` : Col ${err.column}` : ''}
                </span>
              )}
              <span
                style={{
                  textTransform: 'uppercase',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: err.severity === 'warning' ? '#d97706' : '#e11d48',
                  letterSpacing: '0.04em',
                }}
              >
                {err.severity}
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {err.message}
              </span>
            </div>

            {err.source_context && (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  borderLeft: '3px solid #f43f5e',
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: '#334155',
                  marginTop: '2px',
                }}
              >
                {err.source_context}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Source Code Viewer with Error Line Highlighting */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Highlighted Source Code (Line {errorLines.join(', ')})
        </div>
        <CodeViewer code={sourceCode} errorLines={errorLines} title="Student C Submission" theme="light" />
      </div>

      {/* Collapsible Raw GCC Output */}
      <div style={{ borderTop: '1px solid var(--ce-border)', paddingTop: '12px' }}>
        <button
          onClick={() => setShowRawOutput(!showRawOutput)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--ce-text)',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={14} />
            <span>Raw GCC Compiler Output</span>
          </div>
          {showRawOutput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showRawOutput && (
          <div style={{ marginTop: '10px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '4px',
              }}
            >
              <button onClick={copyRaw} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                {copiedRaw ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copiedRaw ? 'Copied' : 'Copy Output'}</span>
              </button>
            </div>
            <pre
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                lineHeight: '1.5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                maxHeight: '260px',
              }}
            >
              {compilation.compiler_output || 'No raw compiler output recorded.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
