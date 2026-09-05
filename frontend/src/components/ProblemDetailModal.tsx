import React from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProblemInPack } from '../types';
import { CodeViewer } from './CodeViewer';

interface Props {
  problem: ProblemInPack | null;
  onClose: () => void;
}

export const ProblemDetailModal: React.FC<Props> = ({ problem, onClose }) => {
  if (!problem) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                P{problem.number}
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{problem.title}</h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: problem.difficulty === 'Easy' ? '#ecfdf5' : '#fffbeb',
                  color: problem.difficulty === 'Easy' ? '#065f46' : '#92400e',
                  border: '1px solid currentColor',
                }}
              >
                {problem.difficulty}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {problem.topics.map((t, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ border: 'none', padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Verification Status Banner */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: problem.is_verified ? '#ecfdf5' : '#fff1f2',
              border: `1px solid ${problem.is_verified ? '#a7f3d0' : '#fecdd3'}`,
            }}
          >
            {problem.is_verified ? (
              <>
                <CheckCircle2 size={18} color="#059669" />
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#065f46' }}>
                  Reference C Solution Verified (100% test cases matched expected output)
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={18} color="#e11d48" />
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#9f1239' }}>
                  Reference solution not verified
                </span>
              </>
            )}
          </div>

          {/* Description */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Problem Description
            </h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.6 }}>{problem.description}</p>
          </div>

          {/* I/O Formats & Constraints */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {problem.input_format && (
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>INPUT FORMAT</h5>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{problem.input_format}</p>
              </div>
            )}
            {problem.output_format && (
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>OUTPUT FORMAT</h5>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{problem.output_format}</p>
              </div>
            )}
          </div>

          {problem.constraints && problem.constraints.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Constraints
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                {problem.constraints.map((c, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>
                    <code>{c}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Public & Hidden Test Cases */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Test Cases ({problem.public_test_cases.length} Public, {problem.hidden_test_cases.length} Hidden)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {problem.public_test_cases.map((tc, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.84rem',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Sample Case #{idx + 1}</span>
                  <div>
                    <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Input:</span>
                    <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px' }}>{tc.input.trim()}</code>
                    <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
                    <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Expected:</span>
                    <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px' }}>{tc.expected_output.trim()}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reference Solution */}
          {problem.reference_solution_c && (
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Verified C Reference Solution
              </h4>
              <CodeViewer code={problem.reference_solution_c} title="reference.c" />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
