'use client';
import { useState, useEffect } from 'react';

interface Bug {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file?: string;
  line?: number;
  description?: string;
  suggested_fix?: string;
}

const SEV_COLOR: Record<string, string> = {
  critical: 'red', high: 'red', medium: 'yellow', low: 'green',
};

export default function BugsTab({ addToast }: { addToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Bug | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/bugs/detect')
      .then(r => r.json())
      .then(d => setBugs(d.bugs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fix = async (bug: Bug, e: React.MouseEvent) => {
    e.stopPropagation();
    setFixing(bug.id);
    try {
      await fetch('http://localhost:8000/api/bugs/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bug_id: bug.id }),
      });
      addToast(`Fix applied: ${bug.title}`);
      setBugs(p => p.filter(b => b.id !== bug.id));
    } catch {
      addToast('Fix failed', 'error');
    } finally {
      setFixing(null);
    }
  };

  const dismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:8000/api/bugs/${id}`, { method: 'DELETE' });
    } catch {}
    setBugs(p => p.filter(b => b.id !== id));
    addToast('Bug dismissed');
  };

  return (
    <div className="animate-in">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detected Bugs</span>
          {!loading && (
            <span className="panel-muted" style={{ fontSize: 10 }}>
              {bugs.length} issue{bugs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="panel-body">
            {[0, 1, 2].map(i => (
              <div key={i} style={{ padding: 'var(--s3) 0', borderBottom: '1px solid var(--divider)' }}>
                <div className="skeleton sk-line" style={{ width: '55%' }} />
                <div className="skeleton sk-line" style={{ width: '30%', height: 8 }} />
              </div>
            ))}
          </div>
        ) : bugs.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M14 4L4 20h20L14 4z" /><path d="M14 12v4M14 18h.01" />
            </svg>
            <p>No bugs detected in current context.</p>
          </div>
        ) : (
          <div style={{ padding: '0 var(--s4)' }}>
            {bugs.map(bug => {
              const col = SEV_COLOR[bug.severity] ?? 'yellow';
              return (
                <div key={bug.id} className="session-row" onClick={() => setOpen(bug)}>
                  <span className={`session-dot ${col}`} />
                  <div className="session-main">
                    <div className="session-title">{bug.title}</div>
                    <div className="session-meta">
                      {bug.file && (
                        <span>{bug.file}{bug.line ? `:${bug.line}` : ''}</span>
                      )}
                      <span className={`tag ${col}`}>{bug.severity}</span>
                    </div>
                  </div>
                  <div className="session-actions">
                    <button
                      className="btn btn-success"
                      style={{ fontSize: 10, padding: '2px 7px' }}
                      disabled={fixing === bug.id}
                      onClick={e => fix(bug, e)}
                    >
                      {fixing === bug.id ? '…' : 'Fix'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 10, padding: '2px 7px' }}
                      onClick={e => dismiss(bug.id, e)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>{open.title}</h3>
              <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
            <div className="drawer-body">
              <div style={{ marginBottom: 'var(--s4)' }}>
                <div className="context-label" style={{ marginBottom: 6 }}>Severity</div>
                <span className={`tag ${SEV_COLOR[open.severity]}`}>{open.severity}</span>
              </div>
              {open.description && (
                <div style={{ marginBottom: 'var(--s4)' }}>
                  <div className="context-label" style={{ marginBottom: 6 }}>Description</div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{open.description}</p>
                </div>
              )}
              {open.suggested_fix && (
                <>
                  <div className="context-label" style={{ marginBottom: 6 }}>Suggested Fix</div>
                  <div className="log-output">{open.suggested_fix}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
