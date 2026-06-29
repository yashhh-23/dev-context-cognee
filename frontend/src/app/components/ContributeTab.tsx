'use client';

import { useEffect, useState } from 'react';

type Opportunity = {
  title: string;
  repository: string;
  html_url: string;
  labels: string[];
  stars: number;
  language: string;
};

export default function ContributeTab() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/bugs/opportunities`);
        if (res.ok) {
          const data = await res.json();
          setOpps(data.opportunities || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [apiUrl]);

  const filtered = opps.filter(o =>
    !filter ||
    o.title.toLowerCase().includes(filter.toLowerCase()) ||
    o.repository.toLowerCase().includes(filter.toLowerCase()) ||
    o.language?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">OSS Contribution Opportunities</span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
            {filtered.length} issues
          </span>
        </div>
        <div className="search-form">
          <input
            className="search-input"
            placeholder="Filter by repo, title, language…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div style={{ padding: 'var(--s4) var(--s5)' }}>
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="contribute-card" style={{ marginBottom: 'var(--s3)' }}>
                <div className="skeleton sk-line" style={{ width: '40%' }} />
                <div className="skeleton sk-line" style={{ width: '70%' }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
                <path d="M9 9h6M9 12h6M9 15h4"/>
              </svg>
              <p>No opportunities found. Ingest logs with errors to discover contribution targets.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--s3)' }}>
              {filtered.map((o, i) => (
                <div key={i} className="contribute-card">
                  <div className="contribute-card-header">
                    <span className="contribute-repo">{o.repository}</span>
                    {o.stars > 0 && (
                      <span className="contribute-stars">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        {o.stars.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="contribute-title">{o.title}</div>
                  <div className="contribute-meta">
                    {o.labels.slice(0, 2).map((l, j) => <span key={j} className="tag purple">{l}</span>)}
                    {o.language && <span className="tag gray">{o.language}</span>}
                  </div>
                  <a
                    href={o.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', alignSelf: 'flex-start' }}
                  >
                    View on GitHub ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
