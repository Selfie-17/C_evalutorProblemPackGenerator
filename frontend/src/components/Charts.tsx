import React from 'react';
import { ProblemAnalyticsItem, VerdictDistribution } from '../types';

interface DonutProps {
  verdicts: VerdictDistribution;
  total: number;
}

export const VerdictDonutChart: React.FC<DonutProps> = ({ verdicts, total }) => {
  if (total === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No submission data yet.</div>;
  }

  const slices = [
    { label: 'Accepted', count: verdicts.accepted, color: '#10b981' },
    { label: 'Wrong Answer', count: verdicts.wrong_answer, color: '#ef4444' },
    { label: 'Compilation Error', count: verdicts.compilation_error, color: '#e11d48' },
    { label: 'Runtime Error', count: verdicts.runtime_error, color: '#f97316' },
    { label: 'Time Limit', count: verdicts.time_limit_exceeded, color: '#f59e0b' },
    { label: 'Not Submitted', count: verdicts.not_submitted, color: '#9ca3af' },
  ].filter((s) => s.count > 0);

  // Calculate SVG stroke dashes for donut
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: '160px', height: '160px' }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="22" />
          {slices.map((slice, idx) => {
            const pct = slice.count / total;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += pct;

            return (
              <circle
                key={idx}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth="22"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
            Programs
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '180px' }}>
        {slices.map((slice, idx) => {
          const pct = ((slice.count / total) * 100).toFixed(1);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: slice.color }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{slice.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{slice.count}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', width: '42px', textAlign: 'right' }}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface BarProps {
  problems: ProblemAnalyticsItem[];
}

export const ProblemPassRateChart: React.FC<BarProps> = ({ problems }) => {
  if (!problems || problems.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No problems available.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {problems.map((p) => {
        const rate = p.acceptance_rate;
        const color = rate >= 75 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444';

        return (
          <div key={p.problem_number} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                P{p.problem_number}: {p.title}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {p.accepted_count} / {p.total_submissions} passed
                </span>
                <span style={{ fontWeight: 700, color }}>{rate.toFixed(1)}%</span>
              </div>
            </div>

            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, rate))}%`,
                  height: '100%',
                  backgroundColor: color,
                  borderRadius: '9999px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
