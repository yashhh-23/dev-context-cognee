'use client';
import { useState, useEffect } from 'react';

interface Session {
  id: string;
  title: string;
  timestamp: string;
  type?: string;
  tags?: string[];
  summary?: string;
  error_log?: string;
}

const COLOR_MAP: Record<string, string> = {
  debug: 'blue', fix: 'green', error: 'red', warning: 'yellow', refactor: 'purple',
};

export default function SessionList({
  addToast,
  compact = false,
  limit,
}: {
  addToast: (msg: string, type?: 'success' | 'error') => void;
  compact?: boolean;
  limit?: number;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Session | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/sessions')
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const forget = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:8000/api/memory/forget/${id}`, { method: 'DELETE' });
      setSessions(p => p.filter(s => s.id !== id));
      addToast('Session forgotten');
    } catch {
      addToast('Failed to forget', 'error');
    }
  };

  const displayed = limit ? sessions.slice(0, limit) : sessions;

  if (loading) return (
    <div style={{ padding: 'var(--s3) var(--s4)' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ padding: 'var(--s3) 0', borderBottom: '1px solid var(--divider)' }}>
          <div className="skeleton sk-line" style={{ width: '60%' }} />
          <div className="skeleton sk-line" style={{ width: '30%', height: 8 }} />
        </div>
      ))}
    </div>
  );

  if (sessions.length === 0) return (
    <div className="empty-state">
      <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="14" cy="14" r="10" /><path d="M10 14h8M14 10v8" />
      </svg>
      <p>No sessions recorded yet. Start debugging to build memory.</p>
    </div>
  );

  return (
    <>
      <div style={{ padding: compact ? '0 var(--s4)' : '0' }}>
        {displayed.map(s => {
          const color = COLOR_MAP[s.type ?? ''] ?? 'gray';
          return (
            <div key={s.id} className="session-row" onClick={() => setOpen(s)}>
              <span className={`session-dot ${color}`} />
              <div className="session-main">
                <div className="session-title">{s.title}</div>
                <div className="session-meta">
                  <span>{new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  {s.type && <span style={{ opacity: 0.6 }}>·</span>}
                  {s.type && <span>{s.type}</span>}
                </div>
                {!compact && s.tags && s.tags.length > 0 && (
                  <div className="session-tags">
                    {s.tags.slice(0, 3).map(t => (
                      <span key={t} className={`tag ${COLOR_MAP[t] ?? 'gray'}`}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="session-actions">
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 10, padding: '2px 7px' }}
                  onClick={e => forget(s.id, e)}
                  aria-label="Forget session"
                >
                  Forget
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>{open.title}</h3>
              <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
            <div className="drawer-body">
              {open.summary && (
                <div style={{ marginBottom: 'var(--s4)' }}>
                  <div className="context-label" style={{ marginBottom: 6 }}>Summary</div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{open.summary}</p>
                </div>
              )}
              {open.error_log && (
                <>
                  <div className="context-label" style={{ marginBottom: 6 }}>Error Log</div>
                  <div className="log-output">{open.error_log}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
