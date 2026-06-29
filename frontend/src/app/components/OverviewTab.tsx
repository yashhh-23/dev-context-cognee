'use client';

import { useEffect, useState } from 'react';
import { Tab } from '../page';

type Session = {
  id: string;
  project: string;
  branch: string;
  timestamp: string;
  status: string;
  tags?: string[];
  error_message?: string;
};

type Stats = { open: number; resolved: number; oss_opportunities: number };

const STATUS_DOT: Record<string, string> = {
  completed: 'green',
  improved:  'purple',
  processing: 'blue',
  queued:    'yellow',
  forgotten: 'gray',
  error:     'red',
};

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function statusTag(s: string) {
  const map: Record<string, string> = {
    completed: 'green', improved: 'purple', processing: 'blue',
    queued: 'yellow', forgotten: 'gray', error: 'red',
  };
  return map[s] ?? 'gray';
}

function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Props = { addToast: (msg: string, type?: 'success' | 'error') => void; onTabChange: (t: Tab) => void };

export default function OverviewTab({ addToast, onTabChange }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/sessions/`);
        if (res.ok) setSessions(await res.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [apiUrl]);

  useEffect(() => {
    const load = async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch(`${apiUrl}/context/summary`);
        if (res.ok) {
          const d = await res.json();
          let text = 'No recent context found.';
          if (d.summary && Array.isArray(d.summary) && d.summary.length > 0)
            text = d.summary[0].text || JSON.stringify(d.summary[0]);
          else if (d.summary)
            text = typeof d.summary === 'string' ? d.summary : JSON.stringify(d.summary);
          setSummary(text);
        }
      } catch {}
      setSummaryLoading(false);
    };
    load();
  }, [apiUrl]);

  const open     = sessions.filter(s => ['queued','processing','error'].includes(s.status)).length;
  const resolved = sessions.filter(s => ['completed','improved'].includes(s.status)).length;

  // Build 7-day bar data from sessions
  const bars = DAYS.map((day, i) => {
    const dayMs = 24 * 3600 * 1000;
    const now = Date.now();
    const start = now - (6 - i) * dayMs;
    const end   = start + dayMs;
    const count = sessions.filter(s => {
      const t = new Date(s.timestamp).getTime();
      return t >= start && t < end;
    }).length;
    const cls = count === 0 ? 'low' : count <= 2 ? 'mid' : 'high';
    return { day, count, cls, height: Math.max(4, count * 18) };
  });

  const handleAction = async (id: string, action: 'forget' | 'improve') => {
    try {
      const res = await fetch(`${apiUrl}/sessions/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setSessions(prev => prev.map(s =>
        s.id === id ? { ...s, status: action === 'forget' ? 'forgotten' : 'improved' } : s
      ));
      addToast(action === 'forget' ? 'Session forgotten' : 'Memory improved', 'success');
    } catch {
      addToast(`Failed to ${action} session`, 'error');
    }
  };

  const depHealth = [
    { name: 'cognee', status: 'stable', color: 'green' },
    { name: 'fastapi', status: 'stable', color: 'green' },
    { name: 'sqlalchemy', status: 'stable', color: 'green' },
  ];

  return (
    <div className="animate-in">
      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-label">Open Bugs</div>
          <div className={`stat-value ${open > 0 ? 'red' : 'green'}`}>{open}</div>
          <div className="stat-delta">active sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Resolved</div>
          <div className="stat-value green">{resolved}</div>
          <div className="stat-delta">completed + improved</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">OSS Opportunities</div>
          <div className="stat-value purple">7</div>
          <div className="stat-delta">
            <button
              style={{ color: 'var(--purple)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', padding: 0 }}
              onClick={() => onTabChange('contribute')}
            >
              view in Contribute →
            </button>
          </div>
        </div>
      </div>

      {/* Context summary */}
      <div className="context-panel">
        <div className="context-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div className="context-body">
          <div className="context-label">Smart Context · Last recall</div>
          <div className="context-text">
            {summaryLoading ? (
              <div>
                <div className="skeleton sk-line" style={{ width: '85%' }} />
                <div className="skeleton sk-line" style={{ width: '60%' }} />
              </div>
            ) : summary || 'No recent context. Ingest a terminal session to get started.'}
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ flexShrink: 0 }}
          onClick={() => {
            setSummaryLoading(true);
            fetch(`${apiUrl}/context/summary`)
              .then(r => r.json())
              .then(d => {
                let text = 'No recent context found.';
                if (d.summary && Array.isArray(d.summary) && d.summary.length > 0)
                  text = d.summary[0].text || JSON.stringify(d.summary[0]);
                else if (d.summary)
                  text = typeof d.summary === 'string' ? d.summary : JSON.stringify(d.summary);
                setSummary(text);
              })
              .catch(() => {})
              .finally(() => setSummaryLoading(false));
          }}
        >
          Refresh
        </button>
      </div>

      {/* Two-column: chart + dep health */}
      <div className="two-col">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Bug Frequency · 7 Days</span>
            <button className="btn btn-ghost" style={{ fontSize: '11px' }} onClick={() => onTabChange('bugs')}>View all →</button>
          </div>
          <div className="panel-body">
            <div className="chart-bars">
              {bars.map(b => (
                <div key={b.day} className="chart-bar-wrap">
                  <div
                    className={`chart-bar ${b.cls}`}
                    style={{ height: `${b.height}px` }}
                    title={`${b.count} sessions`}
                  />
                  <span className="chart-label">{b.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Dep Health</span>
          </div>
          <div className="panel-body" style={{ padding: '0 var(--s5)' }}>
            {depHealth.map(d => (
              <div key={d.name} className="dep-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: `var(--${d.color})`, display: 'inline-block' }} />
                  <span className="dep-name">{d.name}</span>
                </div>
                <span className="dep-status" style={{ color: `var(--${d.color})` }}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent debug history */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recent Debug History</span>
          <button className="btn btn-ghost" style={{ fontSize: '11px' }} onClick={() => onTabChange('bugs')}>Open Bugs →</button>
        </div>
        <div className="panel-body" style={{ padding: '0 var(--s5)' }}>
          {sessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3h18v18H3z" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
              </svg>
              <p>No sessions yet. Use the CLI to ingest your first terminal log.</p>
            </div>
          ) : sessions.slice(0, 8).map(s => (
            <div key={s.id} className="session-row" onClick={() => setSelected(s)}>
              <span className={`session-dot ${STATUS_DOT[s.status] ?? 'gray'}`} />
              <div className="session-main">
                <div className="session-title">{s.error_message || `${s.project} · ${s.branch}`}</div>
                <div className="session-meta">
                  <span>{s.project}</span>
                  <span>·</span>
                  <span>{s.branch}</span>
                  <span>·</span>
                  <span>{relTime(s.timestamp)}</span>
                </div>
                <div className="session-tags">
                  <span className={`tag ${statusTag(s.status)}`}>{s.status}</span>
                  {s.tags?.slice(0, 2).map((t, i) => <span key={i} className="tag gray">{t}</span>)}
                </div>
              </div>
              {s.status !== 'forgotten' && (
                <div className="session-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-success" onClick={() => handleAction(s.id, 'improve')}>Improve</button>
                  <button className="btn btn-danger"  onClick={() => handleAction(s.id, 'forget')}>Forget</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Session drawer */}
      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>{selected.project} / {selected.branch}</h3>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ marginBottom: 'var(--s4)' }}>
                <div className="session-tags" style={{ marginBottom: 'var(--s3)' }}>
                  <span className={`tag ${statusTag(selected.status)}`}>{selected.status}</span>
                  {selected.tags?.map((t, i) => <span key={i} className="tag gray">{t}</span>)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(selected.timestamp).toLocaleString()}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: 'var(--s2)' }}>Terminal output</div>
              <div className="log-output">
                {(selected as any).terminal_output || 'No terminal output stored for this session.'}
              </div>
              {selected.status !== 'forgotten' && (
                <div style={{ display: 'flex', gap: 'var(--s2)', marginTop: 'var(--s4)' }}>
                  <button className="btn btn-success" onClick={() => { handleAction(selected.id, 'improve'); setSelected(null); }}>Improve memory</button>
                  <button className="btn btn-danger"  onClick={() => { handleAction(selected.id, 'forget');  setSelected(null); }}>Forget session</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
