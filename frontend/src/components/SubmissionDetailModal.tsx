import React, { useState } from 'react';
import { X, Clock, FileCode, CheckSquare } from 'lucide-react';
import { StudentSubmissionDetail } from '../types';
import { VerdictBadge } from './VerdictBadge';
import { CodeViewer } from './CodeViewer';
import { CompilationErrorViewer } from './CompilationErrorViewer';
import { TestCaseTable } from './TestCaseTable';

interface Props {
  submission: StudentSubmissionDetail | null;
  studentId: string;
  onClose: () => void;
}

export const SubmissionDetailModal: React.FC<Props> = ({ submission, studentId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'source'>('details');

  if (!submission) return null;

  const isCe = submission.verdict === 'COMPILATION_ERROR';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '960px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                P{submission.problem_number}
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {submission.problem_title}
              </h3>
              <VerdictBadge verdict={submission.verdict} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Student ID: <strong style={{ color: 'var(--text-main)' }}>{studentId}</strong></span>
              <span>•</span>
              <span>File: <code>{submission.source_file}</code></span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} /> {submission.total_time_ms.toFixed(1)} ms
              </span>
              <span>•</span>
              <span>
                Score: <strong style={{ color: 'var(--text-main)' }}>{submission.passed_test_cases} / {submission.total_test_cases}</strong> passed
              </span>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ border: 'none', padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switch for non-CE or overall source view */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('details')}
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            style={{ padding: '12px 16px' }}
          >
            {isCe ? <FileCode size={16} /> : <CheckSquare size={16} />}
            <span>{isCe ? 'Compilation Error Diagnostics' : 'Test Case Results'}</span>
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`tab-btn ${activeTab === 'source' ? 'active' : ''}`}
            style={{ padding: '12px 16px' }}
          >
            <FileCode size={16} />
            <span>Full Source Code ({submission.source_file})</span>
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'details' && (
            <>
              {isCe ? (
                <CompilationErrorViewer compilation={submission.compilation} sourceCode={submission.source_code} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                      Test Case Verdicts ({submission.passed_test_cases} / {submission.total_test_cases} Passed)
                    </h4>
                    <TestCaseTable testCases={submission.test_results} />
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'source' && (
            <div>
              <CodeViewer code={submission.source_code} title={submission.source_file} />
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
