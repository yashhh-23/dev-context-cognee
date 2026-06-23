'use client'

import { useEffect, useState } from 'react'
import { api, type OverviewStats, type Session } from '@/lib/api'

export default function OverviewPage() {
  const [stats,    setStats]    = useState<OverviewStats | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.getStats(), api.getSessions(5)])
      .then(([s, sess]) => {
        setStats(s)
        setSessions(sess)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">overview</h1>
        <p className="page-subtitle">repository health, memory usage, and recent sessions</p>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              <div className="skeleton" style={{ height: '2rem', width: '80%', marginTop: '0.5rem', borderRadius: '4px' }} />
            </div>
          ))
        ) : error ? (
          <ErrorBanner message={error} />
        ) : stats ? (
          <>
            <StatCard label="Sessions" value={stats.total_sessions} delta={null} />
            <StatCard label="Open Bugs" value={stats.open_bugs} delta={null} color="error" />
            <StatCard label="Memory Nodes" value={stats.memory_nodes} delta={null} color="primary" />
            <StatCard label="Recalled Today" value={stats.recalled_today} delta={null} />
            <StatCard
              label="Health Score"
              value={`${stats.health_score}%`}
              delta={null}
              color={stats.health_score >= 80 ? 'success' : stats.health_score >= 50 ? 'warning' : 'error'}
            />
          </>
        ) : null}
      </div>

      <div className="grid-2">
        {/* Recent Sessions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">recent sessions</span>
          </div>
          {loading ? (
            <SkeletonRows n={4} />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon="⌗"
              title="No sessions yet"
              desc="Start a debug session to see history here."
            />
          ) : (
            sessions.map(s => (
              <div key={s.id} className="item-row">
                <div>
                  <div className="item-title">
                    <span className="mono">{s.repo}</span>
                  </div>
                  <div className="item-meta">
                    {s.branch} · {formatRelative(s.last_active)}
                  </div>
                </div>
                <span
                  className="badge badge-default"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {s.context_size} nodes
                </span>
              </div>
            ))
          )}
        </div>

        {/* Dependency / Repo Health */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">dependency health</span>
          </div>
          {loading ? (
            <SkeletonRows n={4} />
          ) : stats ? (
            <>
              <HealthRow label="Memory graph" status={stats.memory_nodes > 0 ? 'ok' : 'warn'} />
              <HealthRow label="Open bugs" status={stats.open_bugs === 0 ? 'ok' : stats.open_bugs < 5 ? 'warn' : 'error'} />
              <HealthRow label="Session continuity" status="ok" />
              <HealthRow label="Recall latency" status="ok" />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ---- Sub-components ---- */

function StatCard({
  label, value, delta, color,
}: {
  label: string
  value: string | number
  delta: string | null
  color?: 'primary' | 'success' | 'warning' | 'error'
}) {
  const colorMap: Record<string, string> = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error:   'var(--color-error)',
  }
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={color ? { color: colorMap[color] } : undefined}
      >
        {value}
      </div>
      {delta && <div className="stat-delta">{delta}</div>}
    </div>
  )
}

function HealthRow({ label, status }: { label: string; status: 'ok' | 'warn' | 'error' }) {
  const dot: Record<string, string> = {
    ok:    'var(--color-success)',
    warn:  'var(--color-warning)',
    error: 'var(--color-error)',
  }
  const text: Record<string, string> = { ok: 'healthy', warn: 'degraded', error: 'failing' }
  return (
    <div className="item-row">
      <span className="item-title">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot[status] }} />
        <span className="item-meta">{text[status]}</span>
      </div>
    </div>
  )
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div style={{ paddingTop: 'var(--space-2)' }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="item-row">
          <div className="skeleton skeleton-text" style={{ width: `${50 + i * 10}%` }} />
          <div className="skeleton skeleton-text" style={{ width: '20%' }} />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="empty-state" style={{ padding: 'var(--space-10) var(--space-4)' }}>
      <div style={{ fontSize: '1.5rem', opacity: 0.4 }}>{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-error-dim)',
        border: '1px solid var(--color-error)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-error)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
      }}
    >
      {message}
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
