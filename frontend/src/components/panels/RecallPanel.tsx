'use client';
import { useState } from 'react';
import { recallMemory, RecallResult } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/shared/EmptyState';

export default function RecallPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecallResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecall() {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await recallMemory(query);
      setResults(res.data.results);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Recall failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <Topbar title="Recall" subtitle="Query your Cognee memory with natural language" />
      <div className="recall-bar">
        <input
          className="recall-input"
          placeholder="e.g. how did I fix the kotlin duplicate class bug?"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRecall()}
        />
        <button
          className="btn btn-primary"
          onClick={handleRecall}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Recalling...' : 'Recall'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {results === null && !loading && (
        <EmptyState icon="⌘" title="Ask your memory" body="Type a question about a past debug session and press Enter." />
      )}

      {results !== null && results.length === 0 && (
        <p className="muted recall-empty">No results found. Try a different query or ingest more sessions.</p>
      )}

      {results !== null && results.length > 0 && (
        <div className="recall-results">
          {results.map((r, i) => (
            <div key={i} className="recall-card">
              <div className="recall-card-num">{i + 1}</div>
              <div className="recall-card-body">
                {r.text ? (
                  <pre className="recall-text">{r.text}</pre>
                ) : (
                  <pre className="recall-text">{JSON.stringify(r, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
