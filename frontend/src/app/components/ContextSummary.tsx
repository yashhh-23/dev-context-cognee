'use client';

import { useEffect, useState } from 'react';

export default function ContextSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/context/summary`);
        if (res.ok) {
          const data = await res.json();
          // Assuming the summary is returned in data.summary or data.summary[0]
          let text = "No recent context found.";
          if (data.summary && Array.isArray(data.summary) && data.summary.length > 0) {
              text = data.summary[0].text || JSON.stringify(data.summary[0]);
          } else if (data.summary) {
              text = typeof data.summary === 'string' ? data.summary : JSON.stringify(data.summary);
          }
          setSummary(text);
        }
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  return (
    <div className="glass-panel" style={{ marginBottom: '32px', borderColor: 'rgba(163, 113, 247, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #a371f7, #58a6ff)', 
          borderRadius: '50%', 
          width: '32px', 
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold'
        }}>?</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Smart Context Summary</h2>
      </div>
      
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Analyzing recent knowledge graph...</p>
      ) : (
        <p style={{ fontSize: '1.1rem', color: '#e6edf3', lineHeight: 1.6 }}>
          {summary || "No recent context found. Try ingesting some logs."}
        </p>
      )}
    </div>
  );
}
