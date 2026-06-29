'use client';

import { useEffect, useState } from 'react';

type Session = {
  id: string;
  project: string;
  branch: string;
  timestamp: string;
  status: string;
  tags?: string[];
};

export default function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/sessions/`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: 600 }}>Recent Ingestions</h2>
      
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No sessions ingested yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.map(session => (
            <div key={session.id} style={{ 
              padding: '16px', 
              background: 'rgba(0,0,0,0.2)', 
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#fff' }}>{session.project}</strong>
                <span className="tag">{session.status}</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Branch: {session.branch} • {new Date(session.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
