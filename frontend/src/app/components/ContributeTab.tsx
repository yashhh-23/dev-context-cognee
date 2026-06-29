'use client';
import { useState, useEffect } from 'react';

interface Suggestion {
  id: string;
  repo: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  stars?: number;
  url?: string;
  why?: string;
  labels?: string[];
}

const DIFF_COLOR: Record<string, string> = { easy: 'green', medium: 'yellow', hard: 'red' };

export default function ContributeTab() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/contribute/suggestions')
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Contribution Opportunities</span>
          {!loading && (
            <span className="panel-muted" style={{ fontSize: 10 }}>{items.length} found</span>
          )}
        </div>

        {loading ? (
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--s3) var(--s4)' }}>
                <div className="skeleton sk-line" style={{ width: '40%', height: 9, marginBottom: 6 }} />
                <div className="skeleton sk-line" style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="14" cy="10" r="5" /><path d="M4 24c0-5.5 4.5-10 10-10s10 4.5 10 10" />
            </svg>
            <p>Sync your context to discover matching open-source issues.</p>
          </div>
        ) : (
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            {items.map(item => (
              <div key={item.id} className="contribute-card">
                <div className="contribute-card-header">
                  <span className="contribute-repo">{item.repo}</span>
                  <span className={`tag ${DIFF_COLOR[item.difficulty] ?? 'gray'}`}>{item.difficulty}</span>
                </div>
                <div className="contribute-title">{item.title}</div>
                {item.why && (
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>{item.why}</div>
                )}
                <div className="contribute-meta">
                  {item.labels?.map(l => (
                    <span key={l} className="tag gray">{l}</span>
                  ))}
                  {item.stars !== undefined && (
                    <span className="contribute-stars">
                      <svg viewBox="0 0 10 10" fill="currentColor" width="9" height="9">
                        <path d="M5 1l1 3h3L6.5 6l1 3L5 7.5 2.5 9l1-3L1 4h3L5 1z" />
                      </svg>
                      {item.stars.toLocaleString()}
                    </span>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost"
                      style={{ fontSize: 10, padding: '2px 7px', marginLeft: 'auto' }}
                    >
                      View issue
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
