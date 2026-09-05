import React, { useEffect, useState } from 'react';
import { Layers, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Week } from '../types';
import { deleteWeek, fetchWeeks } from '../services/api';

interface Props {
  onSelectWeek: (weekId: string) => void;
  onOpenNewWeek: () => void;
  onDeleteWeek?: (weekId: string) => void;
}

export const WeeksView: React.FC<Props> = ({ onSelectWeek, onOpenNewWeek, onDeleteWeek }) => {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWeeks = () => {
    setLoading(true);
    fetchWeeks()
      .then((data) => {
        setWeeks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadWeeks();
  }, []);

  const handleDelete = async (e: React.MouseEvent, weekId: string, weekNumber: number) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete Week ${weekNumber} and all of its problem packs and submission results?\n\nThis action cannot be undone.`)) {
      try {
        await deleteWeek(weekId);
        loadWeeks();
        onDeleteWeek?.(weekId);
      } catch (err: any) {
        alert(err.message || 'Failed to delete week.');
      }
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Laboratory Weeks Management</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Configure weekly curricula, monitor completion status, and evaluate student archives
          </p>
        </div>

        <button onClick={onOpenNewWeek} className="btn btn-primary btn-sm">
          <Plus size={14} />
          <span>New Week</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading weeks...</div>
      ) : weeks.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Layers size={40} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
            No laboratory weeks configured
          </h4>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Get started by adding Week 1 to the evaluation platform.
          </p>
          <button onClick={onOpenNewWeek} className="btn btn-primary">
            <Plus size={16} />
            <span>Create Week 1</span>
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Week</th>
                <th>Title & Objectives</th>
                <th style={{ width: '130px' }}>Problem Count</th>
                <th style={{ width: '130px' }}>Students</th>
                <th style={{ width: '140px' }}>Status</th>
                <th style={{ width: '160px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.id} style={{ cursor: 'pointer' }} onClick={() => onSelectWeek(w.id)}>
                  <td style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                    Week {w.week_number}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{w.title}</div>
                    {w.description && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {w.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{w.problem_count}</span>
                    <span style={{ color: 'var(--text-muted)' }}> / 10 problems</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{w.student_count}</span>
                    <span style={{ color: 'var(--text-muted)' }}> enrolled</span>
                  </td>
                  <td>
                    <span
                      style={{
                        textTransform: 'uppercase',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        backgroundColor:
                          w.status === 'evaluated'
                            ? '#ecfdf5'
                            : w.status === 'evaluating'
                            ? '#eff6ff'
                            : '#f8fafc',
                        color:
                          w.status === 'evaluated'
                            ? '#065f46'
                            : w.status === 'evaluating'
                            ? '#1d4ed8'
                            : '#475569',
                        border: '1px solid currentColor',
                      }}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWeek(w.id);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 10px' }}
                      >
                        <span>Open</span>
                        <ArrowRight size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, w.id, w.week_number)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 8px', color: '#ef4444' }}
                        title="Delete Week"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
