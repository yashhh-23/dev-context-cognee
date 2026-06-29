'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',            label: 'Overview',     icon: '⊞' },
  { href: '/bugs',        label: 'Bugs',         icon: '◎' },
  { href: '/recall',      label: 'Recall',       icon: '⌘' },
  { href: '/graph',       label: 'Memory Graph', icon: '△' },
  { href: '/contribute',  label: 'Contribute',   icon: '➤' },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Dev-Context">
          <rect width="28" height="28" rx="6" fill="#01696f"/>
          <circle cx="14" cy="14" r="5" stroke="#fff" strokeWidth="2" fill="none"/>
          <circle cx="14" cy="14" r="2" fill="#3fb950"/>
          <line x1="14" y1="4" x2="14" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="14" y1="19" x2="14" y2="24" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="4" y1="14" x2="9" y2="14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="19" y1="14" x2="24" y2="14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span>DevContext</span>
      </div>
      <nav>
        {NAV.map(n => (
          <Link key={n.href} href={n.href}
            className={`nav-item${path === n.href ? ' active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="status-dot"></span>
        <span>Cognee connected</span>
      </div>
    </aside>
  );
}
