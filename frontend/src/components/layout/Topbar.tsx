'use client'

import { useEffect, useState } from 'react'

type WsStatus = 'connected' | 'connecting' | 'disconnected'

interface TopbarProps {
  wsStatus: WsStatus
}

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
    : 'http://localhost:8000'

export default function Topbar({ wsStatus }: TopbarProps) {
  const [repo,   setRepo]   = useState<string>('dev-context-cognee')
  const [branch, setBranch] = useState<string>('main')

  useEffect(() => {
    fetch(`${API_BASE}/api/context/summary`)
      .then(r => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (d?.repo)   setRepo(d.repo)
        if (d?.branch) setBranch(d.branch)
      })
      .catch(() => {
        // Sensible fallback — never show a deleted branch name
        setRepo('dev-context-cognee')
        setBranch('main')
      })
  }, [])

  const statusLabel: Record<WsStatus, string> = {
    connected:    'live',
    connecting:   'connecting',
    disconnected: 'offline',
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-context">
          <div className="context-chip" title="Repository">
            <RepoIcon className="chip-icon" />
            {repo}
          </div>
          <span className="context-separator">/</span>
          <div className="context-chip" title="Branch">
            <BranchIcon className="chip-icon" />
            {branch}
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="ws-indicator" title={`Memory stream: ${statusLabel[wsStatus]}`}>
          <div className={`ws-dot ${wsStatus}`} aria-hidden="true" />
          <span>{statusLabel[wsStatus]}</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{
        padding: 'var(--space-1)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-faint)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function RepoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 1v14M4 1l8 0v8H4M4 9l5 5" />
    </svg>
  )
}

function BranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="4" cy="3"  r="1.5" />
      <circle cx="4" cy="13" r="1.5" />
      <circle cx="12" cy="5" r="1.5" />
      <path d="M4 4.5v7M4 4.5 C4 7 12 7 12 6.5" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
