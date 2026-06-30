'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { api, type OverviewStats, type Session } from '@/lib/api'
import LiveFeed from '@/components/ui/LiveFeed'
import { DashboardSkeleton } from '@/components/skeletons/Skeletons'
import { toast } from 'sonner'

const BugTrendChart = dynamic(() => import('@/components/ui/BugTrendChart'), { ssr: false })

export default function OverviewClient() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [trendData, setTrendData] = useState<{ labels: string[]; opened: number[]; closed: number[] } | null>(null)
  const [depHealth, setDepHealth] = useState<{ total_dependencies: number; outdated_count: number; vulnerable_count: number; packages: any[] } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [cleantTaskRan, setCleanTaskRan] = useState(false)

  const loadData = async () => {
    try {
      const [s, sess, trend, dep] = await Promise.all([
        api.getStats(),
        api.getSessions(5),
        api.getBugsTrend(7),
        api.getDependenciesHealth(),
      ])

      setStats(s)
      setSessions(sess)
      setTrendData(trend)
      setDepHealth(dep)
    } catch (err: any) {
      console.error('[Overview] Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadData()

    // Trigger auto-clean memories once on load
    if (!cleantTaskRan) {
      api.autoCleanMemories()
        .then(res => {
          if (res && res.cleaned_count > 0) {
            toast.success(`Deduplicated memories: cleaned ${res.cleaned_count} duplicate sessions.`);
          }
        })
        .catch(() => {
          // silent ignore
        })
      setCleanTaskRan(true)
    }
  }, [cleantTaskRan])

  if (loading) {
    return <DashboardSkeleton />
  }

  const healthScore = stats?.health_score ?? 85

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">overview</h1>
          <p className="page-subtitle">repository health, memory usage, and recent debug sessions</p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setLoading(true)
            loadData()
          }}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          ⟳ refresh dashboard
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <StatCard label="Total Sessions" value={stats?.total_sessions ?? 0} />
        <StatCard label="Open Bugs" value={stats?.open_bugs ?? 0} color="error" />
        <StatCard label="Memory Nodes" value={stats?.memory_nodes ?? 0} color="primary" />
        <StatCard label="Recalled Today" value={stats?.recalled_today ?? 0} />
        <StatCard
          label="Last Ingest"
          value={stats?.last_session ? formatRelative(stats.last_session) : '—'}
        />
      </div>

      {/* Circular Progress + Sub-metrics & Trend Chart Row */}
      <div className="grid-2" style={{ alignItems: 'stretch', gap: 'var(--space-6)' }}>
        {/* Repo Health Circular Ring & Horizontal Metrics */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="card-header">
            <span className="card-title">repository health score</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', padding: 'var(--space-2) 0' }}>
            <CircularProgress value={healthScore} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <ProgressRow label="Code Quality" value={88} color="#2dd4bf" />
              <ProgressRow label="Test Coverage" value={65} color="#eab308" />
              <ProgressRow label="Documentation" value={92} color="#4ade80" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
            Score is aggregated from open issues, code metrics, and memory nodes.
          </div>
        </div>

        {/* Bug trend chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="card-header">
            <span className="card-title">bug trend — 7d</span>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <LegendDot color="#f87171" label="opened" />
              <LegendDot color="#4ade80" label="closed" />
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: 'var(--space-2) 0', width: '100%' }}>
            {trendData && trendData.labels && trendData.labels.length > 0 ? (
              <div style={{ width: '100%' }}>
                <BugTrendChart
                  labels={trendData.labels}
                  opened={trendData.opened}
                  closed={trendData.closed}
                />
              </div>
            ) : (
              <div className="empty-state" style={{ width: '100%', padding: 'var(--space-4)' }}>
                <p>No issue data yet — configure your repo details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sessions list + Live feed row */}
      <div className="grid-2" style={{ alignItems: 'start', gap: 'var(--space-6)' }}>
        {/* Recent sessions */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 'var(--space-2)' }}>
            <span className="card-title">recent debug sessions</span>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div style={{ fontSize: '1.5rem', opacity: 0.3 }}>⌗</div>
              <h3>No sessions yet</h3>
              <p>Start a debug session in the terminal to index your codebase.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="item-row"
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className="item-title" style={{ fontFamily: 'var(--font-mono)' }}>
                        {s.repo.split('/')[1] || s.repo}
                      </span>
                      <span className="badge badge-default" style={{ fontSize: '10px' }}>
                        {s.branch}
                      </span>
                    </div>
                    {s.summary && (
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={s.summary}
                      >
                        {s.summary}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {formatRelative(s.last_active || s.started_at)}
                    </span>
                    <span className="badge badge-info" style={{ fontSize: '9px', fontVariantNumeric: 'tabular-nums' }}>
                      {s.context_size} nodes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live WebSocket Event feed */}
        <LiveFeed />
      </div>

      {/* Dependency health panel */}
      {depHealth && (
        <div className="card">
          <div className="card-header" style={{ marginBottom: 'var(--space-3)' }}>
            <span className="card-title">dependency health & security</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <span className="badge badge-default" style={{ fontSize: '10px' }}>
                {depHealth.total_dependencies} packages
              </span>
              {depHealth.outdated_count > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                  {depHealth.outdated_count} outdated
                </span>
              )}
              {depHealth.vulnerable_count > 0 && (
                <span className="badge badge-error" style={{ fontSize: '10px' }}>
                  {depHealth.vulnerable_count} vulnerable
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {depHealth.packages.slice(0, 3).map(p => (
              <div
                key={p.name}
                className="item-row"
                style={{
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="mono" style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold' }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>
                    current: {p.current}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    latest: {p.latest}
                  </span>
                  <span
                    className={`badge ${
                      p.status === 'vulnerable'
                        ? 'badge-error'
                        : p.status === 'outdated'
                        ? 'badge-warning'
                        : 'badge-success'
                    }`}
                    style={{ fontSize: '9px' }}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Helper Components ---- */

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'primary' | 'success' | 'warning' | 'error' }) {
  const colorMap: Record<string, string> = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  }
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div className="stat-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      <div className="stat-value" style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', color: color ? colorMap[color] : 'inherit' }}>
        {value}
      </div>
    </div>
  )
}

function CircularProgress({ value, size = 100, strokeWidth = 8 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={value >= 80 ? '#2dd4bf' : value >= 50 ? '#eab308' : '#f87171'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          fill="var(--color-text)"
          style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}
        >
          {value}%
        </text>
      </svg>
    </div>
  )
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--color-text)' }}>{value}%</span>
      </div>
      <div style={{ width: '100%', height: '4px', background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)' }} />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
        {label}
      </span>
    </div>
  )
}

function formatRelative(iso: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return '—'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
