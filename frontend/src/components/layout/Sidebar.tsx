'use client'

import Link from 'next/link'

const NAV_ITEMS = [
  {
    section: 'Monitor',
    links: [
      { href: '/overview',   label: 'Overview',  icon: IconGrid },
      { href: '/bugs',       label: 'Bugs',      icon: IconBug },
      { href: '/ingest',     label: 'Ingest',    icon: IconIngest },
    ],
  },
  {
    section: 'Contribute',
    links: [
      { href: '/contribute', label: 'Contribute', icon: IconPR },
    ],
  },
  {
    section: 'Memory',
    links: [
      { href: '/graph',  label: 'Memory Graph', icon: IconGraph },
      { href: '/recall', label: 'Recall',       icon: IconSearch },
    ],
  },
]

export default function Sidebar({ activePath }: { activePath: string }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <DevContextLogo />
        <span className="sidebar-logo-text">
          dev<span>·</span>context
        </span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ section, links }) => (
          <div key={section}>
            <p className="sidebar-section-label">{section}</p>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${activePath.startsWith(href) ? 'active' : ''}`}
                aria-current={activePath.startsWith(href) ? 'page' : undefined}
              >
                <Icon className="nav-icon" />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>
          v0.2.0
        </span>
      </div>
    </aside>
  )
}

/* ---- Inline SVG Logo ---- */
function DevContextLogo() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Dev Context logo"
      aria-hidden="true"
    >
      {/* Outer hexagon (memory graph shape) */}
      <polygon
        points="12,2 20,6.5 20,15.5 12,20 4,15.5 4,6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
      {/* Inner node */}
      <circle cx="12" cy="11" r="2" fill="#2dd4bf" />
      {/* Edges — graph metaphor */}
      <line x1="12" y1="9" x2="12" y2="4"   stroke="#2dd4bf" strokeWidth="1" opacity="0.7" />
      <line x1="12" y1="13" x2="8"  y2="16" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
      <line x1="12" y1="13" x2="16" y2="16" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

/* ---- Icon Components (inline SVG, Lucide-style) ---- */
function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function IconBug({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="9" r="4" />
      <path d="M5.5 5.5 C5.5 3.5 10.5 3.5 10.5 5.5" />
      <line x1="8"  y1="5" x2="8"  y2="3" />
      <line x1="4"  y1="8" x2="1"  y2="7" />
      <line x1="12" y1="8" x2="15" y2="7" />
      <line x1="4"  y1="11" x2="1"  y2="12" />
      <line x1="12" y1="11" x2="15" y2="12" />
    </svg>
  )
}

function IconPR({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="4"  cy="4"  r="1.5" />
      <circle cx="4"  cy="12" r="1.5" />
      <circle cx="12" cy="4"  r="1.5" />
      <line x1="4" y1="5.5" x2="4" y2="10.5" />
      <path d="M12 5.5 C12 8 8 8 6 9 L5.5 10.5" />
    </svg>
  )
}

function IconGraph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8"  cy="8"  r="2" />
      <circle cx="2"  cy="4"  r="1.5" />
      <circle cx="14" cy="4"  r="1.5" />
      <circle cx="2"  cy="12" r="1.5" />
      <circle cx="14" cy="12" r="1.5" />
      <line x1="3.5"  y1="4.8"  x2="6.2"  y2="6.8" />
      <line x1="12.5" y1="4.8"  x2="9.8"  y2="6.8" />
      <line x1="3.5"  y1="11.2" x2="6.2"  y2="9.2" />
      <line x1="12.5" y1="11.2" x2="9.8"  y2="9.2" />
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  )
}

function IconIngest({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 14h12M8 2v9M5 8l3 3 3-3" />
    </svg>
  )
}
