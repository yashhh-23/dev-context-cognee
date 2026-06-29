'use client';
import { useEffect, useState, useCallback } from 'react';
import { getSessions, improveSession, forgetSession, Session } from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import Topbar from '@/components/layout/Topbar';
import TagPill from '@/components/shared/TagPill';
import EmptyState from '@/components/shared/EmptyState';

const STATUS_COLOR: Record<string, string> = {
  completed: '#3fb950',
  failed:    '#f85149',
  queued:    '#d29922',
  processing:'#58a6ff',
  resolved:  '#3fb950',
  forgotten: '#8b949e',
};

export default function BugsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [fixText, setFixText] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await getSessions(0, 50);
      setSessions(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useWebSocket(useCallback((msg) => {
    if (msg.type === 'bug_ingested' || msg.type === 'session_resolved' || msg.type === 'session_forgotten') load();
  }, [load]));

  useEffect(() => { load(); }, [load]);

  async function handleImprove(id: string) {
    setResolving(id);
    try {
      await improveSession(id, fixText[id]);
      await load();
    } finally { setResolving(null); }
  }

  async function handleForget(id: string) {
    if (!confirm('Remove this session from Cognee memory?')) return;
    try {
      await forgetSession(id);
      await load();
    } catch (e) { console.error(e); }
  }

  return (
    <div className="panel">
      <Topbar title="Bugs" subtitle="All ingested sessions and their memory status" />
      {loading ? (
        <div className="skeleton-list">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState icon="◎" title="No sessions yet" body="Ingest a terminal session to start tracking bugs and context." />
      ) : (
        <div className="bug-list">
          {sessions.map(s => (
            <div key={s.id} className="bug-card">
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
              {s.error_message && (
                <p className="bug-error">{s.error_message}</p>
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
