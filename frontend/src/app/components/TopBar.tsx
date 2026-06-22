'use client';
import { useState, useEffect } from 'react';

export default function TopBar() {
  const [branch, setBranch] = useState('main');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/api/context/current')
      .then(r => r.json())
      .then(d => { if (d.branch) setBranch(d.branch); })
      .catch(() => {});
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      await fetch('http://localhost:8000/api/memory/sync', { method: 'POST' });
    } catch {}
    finally { setSyncing(false); }
  };

  return (
    <header className="topbar">
      <div className="topbar-crumb">
        <strong>DevContext</strong>
        <span className="topbar-sep">/</span>
        <span>workspace</span>
      </div>

      <div className="topbar-branch">
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="2" cy="2" r="1.2"/>
          <circle cx="2" cy="8" r="1.2"/>
          <circle cx="8" cy="4" r="1.2"/>
          <path d="M2 3.2v3.6M2 3.2C2 4 5 4 8 4"/>
        </svg>
        {branch}
      </div>

      <div className="topbar-actions">
        <button className="btn btn-ghost" onClick={sync} disabled={syncing}>
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 6A4 4 0 1 1 6 2"/>
            <path d="M6 1l2 1-2 1"/>
          </svg>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>
    </header>
  );
}
