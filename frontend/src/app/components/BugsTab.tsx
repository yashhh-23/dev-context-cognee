'use client';

import { useEffect, useState } from 'react';

type Session = {
  id: string;
  project: string;
  branch: string;
  timestamp: string;
  status: string;
  tags?: string[];
  error_message?: string;
};

type BugAnalysis = {
  similar_past_bugs: any[];
  github_issues: any[];
  contribution_opportunities: any[];
};

const STATUS_DOT: Record<string, string> = {
  completed: 'green', improved: 'purple', processing: 'blue',
  queued: 'yellow', forgotten: 'gray', error: 'red',
};

function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Props = { addToast: (msg: string, type?: 'success' | 'error') => void };

export default function BugsTab({ addToast }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);
  const [analysis, setAnalysis] = useState<BugAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/sessions/`);
        if (res.ok) setSessions(await res.json());
      } catch {}
      setLoading(false);
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [apiUrl]);

  const handleAction = async (id: string, action: 'forget' | 'improve') => {
    try {
      const res = await fetch(`${apiUrl}/sessions/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setSessions(prev => prev.map(s =>
        s.id === id ? { ...s, status: action === 'forget' ? 'forgotten' : 'improved' } : s
      ));
      addToast(action === 'forget' ? 'Session forgotten' : 'Memory improved', 'success');
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: action === 'forget' ? 'forgotten' : 'improved' } : null);
    } catch {
      addToast(`Failed to ${action} session`, 'error');
    }
  };

  const handleAnalyze = async (session: Session) => {
    setSelected(session);
    setAnalysis(null);
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${apiUrl}/bugs/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      });
      if (res.ok) setAnalysis(await res.json());
      else setAnalysis({ similar_past_bugs: [], github_issues: [], contribution_opportunities: [] });
    } catch {
      setAnalysis({ similar_past_bugs: [], github_issues: [], contribution_opportunities: [] });
    }
    setAnalysisLoading(false);
  };

  function statusTag(s: string) {
    const map: Record<string, string> = {
      completed: 'green', improved: 'purple', processing: 'blue',
      queued: 'yellow', forgotten: 'gray', error: 'red',
    };
    return map[s] ?? 'gray';
  }

  return (
    <div className="animate-in">
      <div className="two-col" style={{ alignItems: 'flex-start' }}>
        {/* Session list */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">All Sessions</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
              {sessions.length} total
            </span>
          </div>
          <div style={{ padding: '0 var(--s5)' }}>
            {loading ? (
              <div style={{ padding: 'var(--s4) 0' }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ marginBottom: 'var(--s3)' }}>
                    <div className="skeleton sk-line" style={{ width: '70%' }} />
                    <div className="skeleton sk-line" style={{ width: '45%' }} />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                <p>No sessions. Ingest terminal output via the CLI.</p>
              </div>
            ) : sessions.map(s => (
              <div
                key={s.id}
                className="session-row"
                style={{ background: selected?.id === s.id ? 'rgba(59,130,246,0.05)' : undefined }}
                onClick={() => handleAnalyze(s)}
              >
                <span className={`session-dot ${STATUS_DOT[s.status] ?? 'gray'}`} />
                <div className="session-main">
                  <div className="session-title">{s.project} · {s.branch}</div>
                  <div className="session-meta">
                    <span>{relTime(s.timestamp)}</span>
                  </div>
                  <div className="session-tags">
                    <span className={`tag ${statusTag(s.status)}`}>{s.status}</span>
                  </div>
                </div>
                {s.status !== 'forgotten' && (
                  <div className="session-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-success" onClick={() => handleAction(s.id, 'improve')}>↑</button>
                    <button className="btn btn-danger"  onClick={() => handleAction(s.id, 'forget')}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Analysis panel */}
        <div>
          {!selected ? (
            <div className="panel">
              <div className="empty-state" style={{ padding: 'var(--s10)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <p>Select a session to analyze bugs and find GitHub issues.</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Session info */}
              <div className="panel" style={{ marginBottom: 'var(--s3)' }}>
                <div className="panel-header">
                  <span className="panel-title">{selected.project} / {selected.branch}</span>
                  <span className={`tag ${statusTag(selected.status)}`}>{selected.status}</span>
                </div>
                <div className="panel-body">
                  <div style={{ fontSize: '11px', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--s3)' }}>
                    {new Date(selected.timestamp).toLocaleString()} · {selected.id.slice(0, 8)}
                  </div>
                  {selected.status !== 'forgotten' && (
                    <div style={{ display: 'flex', gap: 'var(--s2)' }}>
                      <button className="btn btn-success" onClick={() => handleAction(selected.id, 'improve')}>Improve memory</button>
                      <button className="btn btn-danger"  onClick={() => handleAction(selected.id, 'forget')}>Forget session</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bug analysis */}
              {analysisLoading ? (
                <div className="panel">
                  <div className="panel-body">
                    <div className="skeleton sk-line" style={{ width: '60%' }} />
                    <div className="skeleton sk-line" style={{ width: '80%' }} />
                    <div className="skeleton sk-line" style={{ width: '50%' }} />
                  </div>
                </div>
              ) : analysis && (
                <>
                  {/* Similar past bugs */}
                  <div className="panel" style={{ marginBottom: 'var(--s3)' }}>
                    <div className="panel-header">
                      <span className="panel-title">Similar bugs in memory</span>
                      <span className="nav-badge">{analysis.similar_past_bugs.length}</span>
                    </div>
                    <div className="panel-body" style={{ padding: '0 var(--s5)' }}>
                      {analysis.similar_past_bugs.length === 0 ? (
                        <div style={{ padding: 'var(--s4) 0', fontSize: '12px', color: 'var(--text-faint)' }}>No similar bugs found in memory.</div>
                      ) : analysis.similar_past_bugs.map((b: any, i: number) => (
                        <div key={i} className="result-card" style={{ marginBottom: 'var(--s2)' }}>
                          <div className="result-label">Match {i + 1}</div>
                          <div className="result-text">{b.text || JSON.stringify(b)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GitHub issues */}
                  <div className="panel" style={{ marginBottom: 'var(--s3)' }}>
                    <div className="panel-header">
                      <span className="panel-title">Same bug on GitHub</span>
                      <span className="nav-badge">{analysis.github_issues.length}</span>
                    </div>
                    <div className="panel-body" style={{ padding: '0 var(--s5)' }}>
                      {analysis.github_issues.length === 0 ? (
                        <div style={{ padding: 'var(--s4) 0', fontSize: '12px', color: 'var(--text-faint)' }}>No public issues found.</div>
                      ) : analysis.github_issues.map((issue: any, i: number) => (
                        <div key={i} className="session-row">
                          <span className="session-dot blue" />
                          <div className="session-main">
                            <div className="session-title">{issue.title}</div>
                            <div className="session-meta">
                              <span>{issue.repository}</span>
                              <span>·</span>
                              <span>{issue.state}</span>
                            </div>
                          </div>
                          <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: '11px' }}>Open ↗</a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contribution opportunities */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">You can fix this</span>
                      <span className="nav-badge purple">{analysis.contribution_opportunities.length}</span>
                    </div>
                    <div className="panel-body" style={{ padding: '0 var(--s5)' }}>
                      {analysis.contribution_opportunities.length === 0 ? (
                        <div style={{ padding: 'var(--s4) 0', fontSize: '12px', color: 'var(--text-faint)' }}>No contribution opportunities right now.</div>
                      ) : analysis.contribution_opportunities.map((opp: any, i: number) => (
                        <div key={i} className="session-row">
                          <span className="session-dot purple" />
                          <div className="session-main">
                            <div className="session-title">{opp.title}</div>
                            <div className="session-meta">
                              <span>{opp.repository}</span>
                            </div>
                            <div className="session-tags">
                              {opp.labels?.map((l: string, j: number) => <span key={j} className="tag purple">{l}</span>)}
                            </div>
                          </div>
                          <a href={opp.html_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: '11px' }}>Contribute ↗</a>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
