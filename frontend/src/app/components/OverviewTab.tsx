'use client';
import { useState, useEffect, useCallback } from 'react';
import { Tab } from '../page';
import ContextSummary from './ContextSummary';
import SessionList from './SessionList';

interface Stats { sessions: number; bugs: number; contributions: number }
interface DepItem { name: string; current: string; latest: string; status: 'ok' | 'outdated' | 'major' }

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function OverviewTab({
  addToast,
  onTabChange,
}: {
  addToast: (msg: string, type?: 'success' | 'error') => void;
  onTabChange: (t: Tab) => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [deps, setDeps] = useState<DepItem[]>([]);
  const [bugHistory] = useState(() =>
    WEEK.map((_, i) => ({ day: WEEK[i], val: Math.floor(Math.random() * 8) }))
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes, cRes] = await Promise.allSettled([
        fetch('http://localhost:8000/api/sessions').then(r => r.json()),
        fetch('http://localhost:8000/api/bugs/detect').then(r => r.json()),
        fetch('http://localhost:8000/api/contribute/suggestions').then(r => r.json()),
      ]);
      const sessions     = sRes.status === 'fulfilled' ? (Array.isArray(sRes.value) ? sRes.value.length : 0) : 0;
      const bugs         = bRes.status === 'fulfilled' ? (bRes.value.bugs?.length ?? 0) : 0;
      const contributions = cRes.status === 'fulfilled' ? (Array.isArray(cRes.value) ? cRes.value.length : 0) : 0;
      setStats({ sessions, bugs, contributions });

      const dRes = await fetch('http://localhost:8000/api/dependencies/health')
        .then(r => r.json())
        .catch(() => ({ dependencies: [] }));
      setDeps(dRes.dependencies ?? []);
    } catch {
      addToast('Failed to load overview', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const maxBug = Math.max(...bugHistory.map(b => b.val), 1);

  return (
    <div className="animate-in">
      {/* Stats */}
      <div className="stats-bar">
        {loading ? (
          [0, 1, 2].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton sk-line" style={{ width: '50%', marginBottom: 8 }} />
              <div className="skeleton sk-line" style={{ height: 24, width: '40%' }} />
            </div>
          ))
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-label">Sessions</div>
              <div className="stat-value purple">{stats?.sessions ?? 0}</div>
              <div className="stat-delta">total recorded</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open Bugs</div>
              <div className="stat-value red">{stats?.bugs ?? 0}</div>
              <div className="stat-delta">detected in context</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Contributions</div>
              <div className="stat-value green">{stats?.contributions ?? 0}</div>
              <div className="stat-delta">opportunities found</div>
            </div>
          </>
        )}
      </div>

      {/* Context summary */}
      <ContextSummary />

      {/* Two-col: chart + deps */}
      <div className="two-col">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Bug Activity — 7d</span>
            <button className="btn btn-ghost" onClick={() => onTabChange('bugs')}>View all</button>
          </div>
          <div className="panel-body">
            <div className="chart-bars">
              {bugHistory.map((b, i) => {
                const pct = (b.val / maxBug) * 100;
                const cls = pct > 66 ? 'high' : pct > 33 ? 'mid' : 'low';
                return (
                  <div key={i} className="chart-bar-wrap">
                    <div
                      className={`chart-bar ${cls}`}
                      style={{ height: `${Math.max(pct, 5)}%` }}
                      title={`${b.val} bugs`}
                    />
                    <span className="chart-label">{b.day.slice(0, 2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Dependency Health</span>
            <span className="panel-muted" style={{ fontSize: 10 }}>
              {deps.filter(d => d.status === 'ok').length}/{deps.length} up-to-date
            </span>
          </div>
          <div className="panel-body">
            {loading ? (
              [0, 1, 2, 3].map(i => (
                <div key={i} className="dep-row">
                  <div className="skeleton sk-line" style={{ width: '40%', height: 10 }} />
                  <div className="skeleton sk-line" style={{ width: '20%', height: 10 }} />
                </div>
              ))
            ) : deps.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--s6)' }}>
                <p>No dependency data</p>
              </div>
            ) : (
              deps.slice(0, 6).map((d, i) => (
                <div key={i} className="dep-row">
                  <span className="dep-name">{d.name}</span>
                  <span className="dep-status" style={{
                    color: d.status === 'ok' ? 'var(--green)' : d.status === 'major' ? 'var(--red)' : 'var(--yellow)'
                  }}>
                    {d.current} → {d.latest}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recent Sessions</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <SessionList addToast={addToast} compact limit={5} />
        </div>
      </div>
    </div>
  );
}
