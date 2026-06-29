'use client';

import { Tab } from '../page';

type Props = { activeTab: Tab; onTabChange: (t: Tab) => void };

const NAV: { id: Tab; label: string; icon: string; badgeKey?: string }[] = [
  { id: 'overview',   label: 'Overview',   icon: 'grid' },
  { id: 'bugs',       label: 'Bugs',       icon: 'bug',       badgeKey: 'bugs' },
  { id: 'contribute', label: 'Contribute', icon: 'git-pull-request', badgeKey: 'contribute' },
  { id: 'recall',     label: 'Recall',     icon: 'search' },
];

const icons: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  bug: '<path d="M8 2a4 4 0 1 0 8 0"/><path d="M12 10v4"/><path d="M10 12h4"/><circle cx="12" cy="14" r="6"/>',
  'git-pull-request': '<circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M21 3l-6 6"/><path d="M15 3h6v6"/><circle cx="18" cy="18" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  branch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
};

const Svg = ({ name, size = 14 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icons[name] ?? '' }} />
);

export default function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg className="sidebar-logo-mark" viewBox="0 0 22 22" fill="none">
          <rect x="1" y="1" width="20" height="20" rx="5" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.2"/>
          <path d="M7 11h3l2-4 2 8 2-4h1" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <div className="sidebar-logo-text">DevContext</div>
          <div className="sidebar-logo-sub">Cognee · memory</div>
        </div>
      </div>

      {/* Workspace nav */}
      <div className="sidebar-section">
        <div className="sidebar-label">Workspace</div>
        {NAV.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <Svg name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="sidebar-divider" />

      {/* Context footer */}
      <div className="sidebar-context">
        <div className="ctx-row">
          <span className="ctx-dot" />
          <span className="ctx-text">Cognee sync active</span>
        </div>
        <div className="ctx-sub">3s ago</div>
      </div>
    </nav>
  );
}
