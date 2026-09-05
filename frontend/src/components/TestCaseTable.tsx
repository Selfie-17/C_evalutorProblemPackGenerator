import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { TestCaseExecutionDetail } from '../types';

interface Props {
  testCases: TestCaseExecutionDetail[];
}

export const TestCaseTable: React.FC<Props> = ({ testCases }) => {
  if (!testCases || testCases.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No test case execution data available.
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th style={{ width: '80px' }}>Test #</th>
            <th style={{ width: '130px' }}>Status</th>
            <th>Input (stdin)</th>
            <th>Expected Output</th>
            <th>Actual Output</th>
            <th style={{ width: '100px', textAlign: 'right' }}>Runtime</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc: TestCaseExecutionDetail) => {
            const isMatch = tc.passed;
            return (
              <tr
                key={tc.test_case_number}
                style={{
                  backgroundColor: !isMatch ? '#fff5f5' : undefined,
                }}
              >
                <td style={{ fontWeight: 600 }}>
                  Case #{tc.test_case_number}
                  {tc.is_hidden && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      (Private)
                    </span>
                  )}
                </td>
                <td>
                  {tc.status === 'accepted' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 600, fontSize: '0.82rem' }}>
                      <CheckCircle2 size={15} /> Passed
                    </span>
                  )}
                  {tc.status === 'wrong_answer' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontWeight: 600, fontSize: '0.82rem' }}>
                      <XCircle size={15} /> Wrong Output
                    </span>
                  )}
                  {tc.status === 'time_limit_exceeded' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontWeight: 600, fontSize: '0.82rem' }}>
                      <Clock size={15} /> TLE
                    </span>
                  )}
                  {tc.status === 'runtime_error' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ea580c', fontWeight: 600, fontSize: '0.82rem' }}>
                      <AlertTriangle size={15} /> Runtime Error
                    </span>
                  )}
                </td>
                <td>
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      background: 'var(--bg-subtle)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tc.input ?? '—'}
                  </code>
                </td>
                <td>
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      background: 'var(--bg-subtle)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tc.expected_output ?? '—'}
                  </code>
                </td>
                <td>
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      background: !isMatch ? '#fee2e2' : 'var(--bg-subtle)',
                      color: !isMatch ? '#b91c1c' : 'inherit',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tc.actual_output ?? (tc.stderr ? `Error: ${tc.stderr}` : '—')}
                  </code>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {tc.execution_time_ms.toFixed(1)} ms
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
