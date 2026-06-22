'use client';

import { useEffect, useState } from 'react';

export default function RecallTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const load = async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch(`${apiUrl}/context/summary`);
        if (res.ok) {
          const d = await res.json();
          let text = '';
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/sessions/search?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="animate-in">
      {/* Context summary */}
      <div className="context-panel" style={{ marginBottom: 'var(--s5)' }}>
        <div className="context-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div className="context-body">
          <div className="context-label">Last recall · Smart context</div>
          <div className="context-text">
            {summaryLoading ? (
              <>
                <div className="skeleton sk-line" style={{ width: '80%' }} />
                <div className="skeleton sk-line" style={{ width: '55%' }} />
              </>
            ) : summary || 'No context yet. Ingest some logs to build memory.'}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="panel">
        <form onSubmit={handleSearch} className="search-form">
          <input
            className="search-input"
            placeholder="Ask Cognee — what broke in auth? what was I working on?"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '…' : 'Recall'}
          </button>
        </form>

        <div className="search-results">
          {!results.length && !loading ? (
            <div className="empty-state" style={{ padding: 'var(--s8) 0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p>Type a question above to search your Cognee knowledge graph.</p>
            </div>
          ) : loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="result-card">
                <div className="skeleton sk-line" style={{ width: '30%', marginBottom: 8 }} />
                <div className="skeleton sk-line" style={{ width: '85%' }} />
                <div className="skeleton sk-line" style={{ width: '60%' }} />
              </div>
            ))
          ) : results.map((r, i) => (
            <div key={i} className="result-card">
              <div className="result-label">Result {i + 1}</div>
              <div className="result-text">{r.text || JSON.stringify(r, null, 2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
