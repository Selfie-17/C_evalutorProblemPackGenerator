import React, { useEffect, useState } from 'react';
import {
  Layers,
  LayoutDashboard,
  Calendar,
  Terminal,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { HealthStatus, Week } from './types';
import { fetchHealth, fetchWeeks } from './services/api';
import { DashboardView } from './views/DashboardView';
import { WeeksView } from './views/WeeksView';
import { WeekDetailView } from './views/WeekDetailView';
import { NewWeekModal } from './components/NewWeekModal';
import { TestCompilerModal } from './components/TestCompilerModal';

export function App() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'weeks' | 'week_detail'>('dashboard');
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isNewWeekModalOpen, setIsNewWeekModalOpen] = useState(false);
  const [isTestCompilerOpen, setIsTestCompilerOpen] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const loadData = () => {
    fetchWeeks()
      .then((data) => {
        setWeeks(data);
        setBackendError(null);
      })
      .catch((err) => {
        console.error(err);
        setBackendError(err.message || 'Failed to connect to backend API');
      });
    fetchHealth()
      .then(setHealth)
      .catch(() => null);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectWeek = (weekId: string) => {
    setSelectedWeekId(weekId);
    setActiveNav('week_detail');
  };

  const handleWeekCreated = (newWeek: Week) => {
    loadData();
    handleSelectWeek(newWeek.id);
  };

  const handleWeekDeleted = (deletedWeekId: string) => {
    loadData();
    if (selectedWeekId === deletedWeekId) {
      setSelectedWeekId(null);
      setActiveNav('dashboard');
    }
  };

  const nextWeekNumber = weeks.length > 0 ? Math.max(...weeks.map((w) => w.week_number)) + 1 : 1;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">
              <Code2 size={22} />
            </div>
            <div>
              <div className="brand-title">C Lab Evaluator</div>
              <div className="brand-subtitle">LeetCode C Judge & Batch Engine</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveNav('dashboard')}
            className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveNav('weeks')}
            className={`nav-item ${activeNav === 'weeks' ? 'active' : ''}`}
          >
            <Layers size={18} />
            <span>Laboratory Weeks</span>
          </button>


          {/* If a week is active, show quick shortcut */}
          {selectedWeekId && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '0 14px 8px',
                  letterSpacing: '0.05em',
                }}
              >
                Active Week
              </div>
              <button
                onClick={() => setActiveNav('week_detail')}
                className={`nav-item ${activeNav === 'week_detail' ? 'active' : ''}`}
              >
                <Calendar size={18} />
                <span>
                  {weeks.find((w) => w.id === selectedWeekId)
                    ? `Week ${weeks.find((w) => w.id === selectedWeekId)!.week_number} Hub`
                    : 'Week Hub'}
                </span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer with GCC Status */}
        <div className="sidebar-footer">
          <div
            onClick={() => setIsTestCompilerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: health?.gcc_available ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${health?.gcc_available ? '#a7f3d0' : '#fecaca'}`,
              cursor: 'pointer',
            }}
            title="Click to open C Compiler Test Sandbox"
          >
            <Terminal size={16} color={health?.gcc_available ? '#059669' : '#dc2626'} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: health?.gcc_available ? '#065f46' : '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {health?.gcc_available ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  <span>{health?.gcc_available ? 'GCC Ready' : 'Compiler Offline'}</span>
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#4f46e5',
                    backgroundColor: '#eef2ff',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  Test
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={health?.gcc_path}
              >
                {health?.gcc_version ? health.gcc_version.split('\n')[0] : 'gcc'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header">
          <h1 className="page-title">
            {activeNav === 'dashboard' && 'Dashboard Overview'}
            {activeNav === 'weeks' && 'Laboratory Weeks'}
            {activeNav === 'week_detail' &&
              (weeks.find((w) => w.id === selectedWeekId)
                ? `Week ${weeks.find((w) => w.id === selectedWeekId)!.week_number}: ${
                    weeks.find((w) => w.id === selectedWeekId)!.title
                  }`
                : 'Week Hub')}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setIsTestCompilerOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Open C Compiler Live Diagnostic & Code Runner"
            >
              <Terminal size={15} color="#4f46e5" />
              <span>Test Compiler</span>
            </button>
            <button onClick={() => setIsNewWeekModalOpen(true)} className="btn btn-primary btn-sm">
              <span>+ Create Week</span>
            </button>
          </div>
        </header>
        {backendError && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 16px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <AlertTriangle size={20} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: 1.5 }}>
              <strong>Backend Connection Notice:</strong> {backendError}
              <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#b45309' }}>
                If you deployed on Vercel, please set <code>VITE_API_URL</code> in Vercel <strong>Settings &rarr; Environment Variables</strong> to your Render backend URL (e.g. <code>https://c-lab-evaluator-backend.onrender.com</code>) and trigger a <strong>Redeploy</strong>.
              </div>
            </div>
          </div>
        )}

        <div className="content-body">
          {activeNav === 'dashboard' && (
            <DashboardView
              onSelectWeek={handleSelectWeek}
              onOpenNewWeek={() => setIsNewWeekModalOpen(true)}
              onDeleteWeek={handleWeekDeleted}
              onOpenTestCompiler={() => setIsTestCompilerOpen(true)}
            />
          )}

          {activeNav === 'weeks' && (
            <WeeksView
              onSelectWeek={handleSelectWeek}
              onOpenNewWeek={() => setIsNewWeekModalOpen(true)}
              onDeleteWeek={handleWeekDeleted}
            />
          )}


          {activeNav === 'week_detail' && selectedWeekId && (
            <WeekDetailView
              weekId={selectedWeekId}
              onBack={() => setActiveNav('dashboard')}
              onDeleteWeek={handleWeekDeleted}
            />
          )}
        </div>
      </main>

      {/* New Week Modal */}
      <NewWeekModal
        isOpen={isNewWeekModalOpen}
        onClose={() => setIsNewWeekModalOpen(false)}
        onCreated={handleWeekCreated}
        nextWeekNumber={nextWeekNumber}
      />

      {/* Test Compiler Diagnostic Modal */}
      <TestCompilerModal
        isOpen={isTestCompilerOpen}
        onClose={() => setIsTestCompilerOpen(false)}
        initialHealth={health}
      />
    </div>
  );
}

export default App;
