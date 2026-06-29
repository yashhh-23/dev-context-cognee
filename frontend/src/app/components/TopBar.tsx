'use client';

export default function TopBar() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleSync = async () => {
    try {
      await fetch(`${apiUrl}/health`);
    } catch {}
  };

  return (
    <div className="topbar">
      <div className="topbar-breadcrumb">
        <strong>pocketmind</strong>
        <span className="topbar-sep">/</span>
        <span>dev-context-cognee</span>
      </div>
      <div className="topbar-branch">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"/>
          <circle cx="18" cy="6" r="3"/>
          <circle cx="6" cy="18" r="3"/>
          <path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
        main
      </div>
      <div className="topbar-actions">
        <button className="btn btn-ghost" onClick={handleSync}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6"/>
            <path d="M2.5 22v-6h6"/>
            <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/>
          </svg>
          Sync
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const msg = prompt('Paste terminal output to ingest:');
            if (!msg) return;
            const proj = prompt('Project name:') || 'unnamed';
            const branch = prompt('Branch name:') || 'main';
            fetch(`${apiUrl}/ingest/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ project: proj, branch, terminal_output: msg }),
            }).catch(() => {});
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Log Bug
        </button>
      </div>
    </div>
  );
}
