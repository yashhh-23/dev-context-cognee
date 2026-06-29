'use client';
import { useState } from 'react';

interface RecallResult { node_id: string; content: string; score?: number; type?: string }

export default function RecallTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecallResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const recall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await fetch('http://localhost:8000/api/memory/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      setResults(Array.isArray(d) ? d : d.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <div className="panel">
        <form className="search-form" onSubmit={recall}>
          <input
            className="search-input"
            placeholder="Search memory — e.g. 'auth bug last week', 'null pointer fix'"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '…' : 'Recall'}
          </button>
        </form>

        {loading ? (
          <div className="search-results">
            {[0, 1, 2].map(i => (
              <div key={i} className="result-card">
                <div className="skeleton sk-line" style={{ width: '30%', height: 8, marginBottom: 6 }} />
                <div className="skeleton sk-line" style={{ width: '90%' }} />
                <div className="skeleton sk-line" style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        ) : searched && results.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="12" cy="12" r="8" /><path d="M18 18 24 24" />
            </svg>
            <p>No memory matches found for &ldquo;{query}&rdquo;</p>
          </div>
        ) : results.length > 0 ? (
          <div className="search-results">
            {results.map((r, i) => (
              <div key={r.node_id ?? i} className="result-card">
                <div className="result-label">
                  {r.type ?? 'memory'}{r.score ? ` · ${(r.score * 100).toFixed(0)}%` : ''}
                </div>
                <div className="result-text">{r.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="12" cy="12" r="8" /><path d="M18 18 24 24" />
            </svg>
            <p>Search your Cognee memory graph — sessions, bugs, and context recalled semantically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
