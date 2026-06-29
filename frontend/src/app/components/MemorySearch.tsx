'use client';

import { useState } from 'react';

export default function MemorySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/sessions/search?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      } else {
        setResults({ error: 'Search failed' });
      }
    } catch (error) {
      console.error('Failed to search memory:', error);
      setResults({ error: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: 600 }}>Memory Search</h2>
      
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Ask Cognee about your code..." 
          className="input-premium"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-premium" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results && Array.isArray(results) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No matches found.</p>
          ) : (
            results.map((result: any, i: number) => (
              <div key={i} style={{ 
                padding: '16px', 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '12px',
                border: '1px solid var(--card-border)',
                color: 'var(--text-primary)'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '8px' }}>
                  Result Match
                </div>
                <div style={{ fontSize: '0.9rem', color: '#e6edf3', whiteSpace: 'pre-wrap' }}>
                  {result.text || JSON.stringify(result, null, 2)}
                </div>
              </div>
            ))
          )}
        </div>
      ) : results && (
        <div style={{ 
          padding: '16px', 
          background: 'rgba(0,0,0,0.3)', 
          borderRadius: '12px',
          border: '1px solid var(--card-border)',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)'
        }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
