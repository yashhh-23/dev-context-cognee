'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, Session } from '@/lib/api';
import { useWebSocket } from '@/lib/ws';
import Topbar from '@/components/layout/Topbar';
import TagPill from '@/components/shared/TagPill';
import EmptyState from '@/components/shared/EmptyState';

const STATUS_COLOR: Record<string, string> = {
  completed: '#3fb950',
  failed: '#f85149',
  queued: '#d29922',
  processing: '#58a6ff',
  resolved: '#3fb950',
  forgotten: '#8b949e',
};

export default function BugsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [fixText, setFixText] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api.getSessions(50);
      setSessions(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'bug_ingested' || msg.type === 'session_resolved' || msg.type === 'session_forgotten') {
        load();
      }
    });
    return unsub;
  }, [subscribe, load]);

  useEffect(() => { load(); }, [load]);

  async function handleImprove(id: string) {
    setResolving(id);
    try {
      await api.improveSession(id, fixText[id]);
      await load();
    } finally { setResolving(null); }
  }

  async function handleForget(id: string) {
    if (!confirm('Remove this session from Cognee memory?')) return;
    try {
      await api.forgetSession(id);
      await load();
    } catch (e) { console.error(e); }
  }

  return (
    <div className="panel max-w-7xl mx-auto p-6 md:p-8 w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Topbar title="Bugs" subtitle="All ingested sessions and their memory status" />
      {loading ? (
        <div className="skeleton-list">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState icon="◎" title="No sessions yet" body="Ingest a terminal session to start tracking bugs and context." />
      ) : (
        <div className="bug-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {sessions.map(s => (
            <div key={s.id} className="bug-card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="bug-card-header">
                <div className="bug-meta">
                  <span className="bug-project">{s.project}</span>
                  {s.branch && <span className="muted">{s.branch}</span>}
                </div>
                <span
                  className="status-badge"
                  style={{ background: STATUS_COLOR[s.status] + '22', color: STATUS_COLOR[s.status] }}
                >
                  {s.status}
                </span>
              </div>
              <p className="bug-timestamp muted">
                {new Date(s.timestamp).toLocaleString()}
              </p>
              {s.tags && s.tags.length > 0 && (
                <div className="tag-row">
                  {s.tags.map(t => <TagPill key={t} label={t} />)}
                </div>
              )}
              {s.error_message && s.status !== 'resolved' && (
                <p className="bug-error">{s.error_message}</p>
              )}
              {s.status === 'resolved' && (
                <div style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  background: 'var(--color-surface-offset)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--color-success)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ⚡ Memory Improved (Before vs. After)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ color: 'var(--color-error)', textDecoration: 'line-through', padding: '4px 6px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', textOutline: 'none', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      - Log: {s.terminal_output ? s.terminal_output.slice(0, 100) : 'Original log content'}...
                    </div>
                    <div style={{ color: 'var(--color-success)', padding: '4px 6px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: 'var(--radius-sm)' }}>
                      + Fix Applied: {s.error_message || 'Marked session resolved.'}
                    </div>
                  </div>
                </div>
              )}
              {s.status !== 'resolved' && s.status !== 'forgotten' && (
                <div className="bug-actions">
                  <input
                    className="fix-input"
                    placeholder="Describe the fix (optional)"
                    value={fixText[s.id] ?? ''}
                    onChange={e => setFixText(f => ({ ...f, [s.id]: e.target.value }))}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleImprove(s.id)}
                    disabled={resolving === s.id}
                  >
                    {resolving === s.id ? '...' : 'Mark Resolved'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleForget(s.id)}
                  >
                    Forget
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
