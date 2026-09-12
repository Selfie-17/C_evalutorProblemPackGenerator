import React, { useEffect, useState } from 'react';
import { Layers, Users, CheckCircle, Code2, Plus, Terminal, Activity, ArrowRight, Trash2 } from 'lucide-react';
import { HealthStatus, Week } from '../types';
import { deleteWeek, fetchHealth, fetchWeeks } from '../services/api';
import { StatCard } from '../components/StatCard';

interface Props {
  onSelectWeek: (weekId: string) => void;
  onOpenNewWeek: () => void;
  onDeleteWeek?: (weekId: string) => void;
  onOpenTestCompiler?: () => void;
}

export const DashboardView: React.FC<Props> = ({ onSelectWeek, onOpenNewWeek, onDeleteWeek, onOpenTestCompiler }) => {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchWeeks(), fetchHealth().catch(() => null)])
      .then(([weeksData, healthData]) => {
        setWeeks(weeksData);
        setHealth(healthData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const totalStudents = weeks.reduce((acc, w) => acc + (w.student_count || 0), 0);
  const totalProblems = weeks.reduce((acc, w) => acc + (w.problem_count || 0), 0);

  const handleDeleteWeek = async (e: React.MouseEvent, weekId: string, weekNumber: number, title: string) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to delete Week ${weekNumber} ("${title}") and all of its problem packs and submission results?\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteWeek(weekId);
      setWeeks((prev) => prev.filter((w) => w.id !== weekId));
      onDeleteWeek?.(weekId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete week.');
    }
  };

  return (
    <div>
      {/* Top Banner with Compiler Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          backgroundColor: 'white',
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
            C Lab Evaluation Platform
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Automated batch C code judge, LeetCode problem pack generator, and student analytics
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            onClick={onOpenTestCompiler}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: health?.gcc_available ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${health?.gcc_available ? '#a7f3d0' : '#fecaca'}`,
              cursor: onOpenTestCompiler ? 'pointer' : 'default',
            }}
            title={onOpenTestCompiler ? "Click to test compiler sandbox" : undefined}
          >
            <Terminal size={16} color={health?.gcc_available ? '#059669' : '#dc2626'} />
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: health?.gcc_available ? '#065f46' : '#991b1b' }}>
              GCC: {health?.gcc_available ? 'GCC Ready' : 'Compiler Offline'}
            </div>
          </div>

          {onOpenTestCompiler && (
            <button
              onClick={onOpenTestCompiler}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Open C Compiler live test sandbox"
            >
              <Terminal size={16} color="#4f46e5" />
              <span>Test Compiler</span>
            </button>
          )}

          <button onClick={onOpenNewWeek} className="btn btn-primary">
            <Plus size={16} />
            <span>Create Week</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stats-grid">
        <StatCard
          label="Configured Weeks"
          value={weeks.length}
          description="Total active laboratory cycles"
          icon={<Layers size={20} color="var(--primary)" />}
        />
        <StatCard
          label="Total Students"
          value={totalStudents}
          description="Enrolled across all lab weeks"
          icon={<Users size={20} color="#06b6d4" />}
        />
        <StatCard
          label="Curriculum Problems"
          value={totalProblems}
          description="Verified LeetCode-style C problems"
          icon={<Code2 size={20} color="#8b5cf6" />}
        />
        <StatCard
          label="GCC Engine"
          value={health?.gcc_available ? '100% OK' : 'Degraded'}
          description={health?.gcc_version ? health.gcc_version.slice(0, 24) : 'UCRT64 GCC 16.2.0'}
          icon={<Activity size={20} color="#10b981" />}
        />
      </div>

      {/* Weeks Table Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Laboratory Weeks</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Select a week to manage problem packs, upload student ZIPs, or inspect evaluations
            </p>
          </div>
          <button onClick={onOpenNewWeek} className="btn btn-secondary btn-sm">
            <Plus size={14} />
            <span>Add Week</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading weeks...</div>
        ) : weeks.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Layers size={40} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              No laboratory weeks configured yet
            </h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Create Week 1 to start setting up problem packs and evaluating student C programs.
            </p>
            <button onClick={onOpenNewWeek} className="btn btn-primary">
              <Plus size={16} />
              <span>Create Week 1 Now</span>
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Week</th>
                  <th>Title & Objectives</th>
                  <th style={{ width: '130px' }}>Problems</th>
                  <th style={{ width: '130px' }}>Students</th>
                  <th style={{ width: '140px' }}>Status</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.id} style={{ cursor: 'pointer' }} onClick={() => onSelectWeek(w.id)}>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>Week {w.week_number}</td>
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
                      <span style={{ color: 'var(--text-muted)' }}> {w.problem_count === 1 ? 'problem' : 'problems'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{w.student_count}</span>
                      <span style={{ color: 'var(--text-muted)' }}> students</span>
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
                          <span>Open Hub</span>
                          <ArrowRight size={13} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteWeek(e, w.id, w.week_number, w.title)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 8px', color: '#ef4444' }}
                          title={`Delete Week ${w.week_number}`}
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
    </div>
  );
};
