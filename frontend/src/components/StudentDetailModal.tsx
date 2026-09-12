import React, { useEffect, useState } from 'react';
import { X, Download, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { StudentDetailResponse, StudentSubmissionDetail } from '../types';
import { fetchStudentDetail, getExportStudentJsonUrl } from '../services/api';
import { VerdictBadge } from './VerdictBadge';
import { SubmissionDetailModal } from './SubmissionDetailModal';

interface Props {
  weekId: string;
  studentId: string | null;
  onClose: () => void;
}

export const StudentDetailModal: React.FC<Props> = ({ weekId, studentId, onClose }) => {
  const [data, setData] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmissionDetail | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    fetchStudentDetail(weekId, studentId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [weekId, studentId]);

  if (!studentId) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Student {studentId}
                </h3>
                <span
                  style={{
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  Week {data?.week_number || 1}
                </span>
                <span
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {data?.summary?.section || data?.section || 'Section A'}
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Individual laboratory performance overview and submission inspection
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <a
                href={getExportStudentJsonUrl(weekId, studentId)}
                download={`student_${studentId}_week_${data?.week_number || 1}.json`}
                className="btn btn-secondary btn-sm"
              >
                <Download size={14} />
                <span>Download Student JSON</span>
              </a>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ border: 'none', padding: '6px' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="modal-body">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading student submissions...
              </div>
            ) : !data ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
                Failed to load student details.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Summary Scorecard */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '12px',
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '16px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SOLVED</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {data.summary.solved_count} / {data.summary.total_problems}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>AC RATE</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                      {data.summary.acceptance_rate.toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>COMPILATION ERRORS</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e11d48' }}>
                      {data.summary.compilation_errors}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>WRONG ANSWERS</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>
                      {data.summary.wrong_answers}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>AVG RUNTIME</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {data.summary.average_time_ms.toFixed(1)} ms
                    </div>
                  </div>
                </div>

                {/* Submissions Table P1..P10 */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                    Program Results (P1 - P{data.submissions.length})
                  </h4>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>#</th>
                          <th>Problem Title</th>
                          <th style={{ width: '170px' }}>Verdict</th>
                          <th style={{ width: '130px' }}>Test Cases</th>
                          <th style={{ width: '100px' }}>Runtime</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.submissions.map((sub: StudentSubmissionDetail) => (
                          <tr key={sub.submission_id}>
                            <td style={{ fontWeight: 700 }}>P{sub.problem_number}</td>
                            <td style={{ fontWeight: 600 }}>{sub.problem_title}</td>
                            <td>
                              <VerdictBadge verdict={sub.verdict} size="sm" />
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{sub.passed_test_cases}</span>
                              <span style={{ color: 'var(--text-muted)' }}> / {sub.total_test_cases}</span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {sub.total_time_ms > 0 ? `${sub.total_time_ms.toFixed(1)} ms` : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                onClick={() => setSelectedSubmission(sub)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '5px 10px' }}
                              >
                                <Eye size={13} />
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
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

      {/* Drill-down submission detail modal */}
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          studentId={studentId}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </>
  );
};
