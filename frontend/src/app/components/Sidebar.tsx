'use client';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  bugCount?: number;
  contributeCount?: number;
}

export default function Sidebar({ activeTab, onTabChange, bugCount = 0, contributeCount = 0 }: SidebarProps) {
  const nav = [
    { id: 'overview',   label: 'Overview',   icon: <GridIcon /> },
    { id: 'bugs',       label: 'Bugs',        icon: <BugIcon />,   badge: bugCount > 0 ? { val: bugCount, cls: 'red' } : null },
    { id: 'contribute', label: 'Contribute',  icon: <GitPRIcon />, badge: contributeCount > 0 ? { val: contributeCount, cls: 'green' } : null },
    { id: 'recall',     label: 'Recall',      icon: <SearchIcon /> },
  ] as const;

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <svg className="sidebar-logo-mark" viewBox="0 0 20 20" fill="none" aria-label="DevContext logo">
          <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity="0.9"/>
          <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity="0.5"/>
          <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity="0.5"/>
          <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/>
        </svg>
        <span className="sidebar-logo-name">DevContext</span>
        <span className="sidebar-logo-tag">v0.1</span>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-group-label">Workspace</div>
        {nav.map(item => {
          const badge = 'badge' in item ? item.badge : null;
          return (
            <button
              key={item.id}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              {item.icon}
              {item.label}
              {badge && (
                <span className={`nav-badge ${badge.cls}`}>{badge.val}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="footer-row">
          <span className="status-dot" />
          <span className="footer-text">cognee memory</span>
        </div>
        <div className="footer-sub">active · graph+vector</div>
      </div>
    </nav>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="1" width="5" height="5" rx="1"/>
      <rect x="8" y="1" width="5" height="5" rx="1"/>
      <rect x="1" y="8" width="5" height="5" rx="1"/>
      <rect x="8" y="8" width="5" height="5" rx="1"/>
    </svg>
  );
}
function BugIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="8" r="3.5"/>
      <path d="M5 3.5 7 5 9 3.5M2 7h2M10 7h2M3 10.5l1.5-1M11 10.5l-1.5-1M3 5.5l1.5 1M11 5.5l-1.5 1"/>
    </svg>
  );
}
function GitPRIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="3" cy="3.5" r="1.5"/>
      <circle cx="3" cy="10.5" r="1.5"/>
      <circle cx="11" cy="4.5" r="1.5"/>
      <path d="M3 5v3M3 12v-.5M11 6c0 3-2.5 4.5-5 4.5H5"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="6" cy="6" r="4"/>
      <path d="M9.5 9.5 12 12"/>
    </svg>
  );
}
