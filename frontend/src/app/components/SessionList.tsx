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
    const intervalId = setInterval(fetchSessions, 5000); // Auto-refresh every 5s
    return () => clearInterval(intervalId);
  }, []);

  const handleAction = async (id: string, action: 'forget' | 'improve') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${apiUrl}/sessions/${id}/${action}`, { method: 'POST' });
      // update state locally to feel fast
      setSessions(prev => prev.map(s => 
        s.id === id ? { ...s, status: action === 'forget' ? 'forgotten' : 'improved' } : s
      ));
    } catch (e) {
      console.error(`Failed to ${action} session ${id}`);
    }
  };

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
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Branch: {session.branch} • {new Date(session.timestamp).toLocaleString()}
              </div>
              
              {session.status !== 'forgotten' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleAction(session.id, 'improve')}
                    style={{ background: 'rgba(88, 166, 255, 0.1)', color: 'var(--accent)', border: '1px solid var(--accent-glow)', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Improve
                  </button>
                  <button 
                    onClick={() => handleAction(session.id, 'forget')}
                    style={{ background: 'rgba(255, 88, 88, 0.1)', color: '#ff5858', border: '1px solid rgba(255, 88, 88, 0.2)', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Forget
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
