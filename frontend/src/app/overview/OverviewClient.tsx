'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { api, type OverviewStats, type Session } from '@/lib/api'
import LiveFeed from '@/components/ui/LiveFeed'
import { DashboardSkeleton } from '@/components/skeletons/Skeletons'
import MemoryHealthModal from '@/components/ui/MemoryHealthModal'
import { useHealth } from '@/hooks/useHealth'
import { formatRelativeSafe, safeRepoName } from '@/lib/utils'
import IngestProgress from '@/components/IngestProgress'

const BugTrendChart = dynamic(() => import('@/components/ui/BugTrendChart'), { ssr: false })

const AUTO_CLEAN_KEY = 'devctx_auto_clean_enabled'

const AnimatedGraphIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--color-primary)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      animation: 'pulse-scale 2s infinite ease-in-out',
    }}
  >
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
)

const AnimatedBugIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--color-warning)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      animation: 'bug-wiggle 1.5s infinite ease-in-out',
    }}
  >
    <rect width="8" height="14" x="8" y="6" rx="4" />
    <path d="M12 2v4M12 20v2M4 9h4M16 9h4M4 14h4M16 14h4M6 5c1-1 3-2 6-2s5 1 6 2" />
  </svg>
)

const AnimatedContinuityIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--color-info)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      animation: 'glow-flow 1.8s infinite ease-in-out',
    }}
  >
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)

const AnimatedLatencyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      opacity: 0.8
    }}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" style={{
      transformOrigin: '12px 12px',
      animation: 'clock-spin 5s infinite linear'
    }} />
  </svg>
)

export default function OverviewClient() {
  const { isHealthy } = useHealth()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [trendData, setTrendData] = useState<{ labels: string[]; opened: number[]; closed: number[] } | null>(null)
  const [depHealth, setDepHealth] = useState<{ total_dependencies: number; outdated_count: number; vulnerable_count: number; packages: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [healthOpen, setHealthOpen] = useState(false)
  const [autoCleanEnabled, setAutoCleanEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(AUTO_CLEAN_KEY)
    return stored === null ? true : stored === 'true'
  })

  const handleToggleAutoClean = (v: boolean) => {
    setAutoCleanEnabled(v)
    localStorage.setItem(AUTO_CLEAN_KEY, String(v))
  }

  const loadData = useCallback(async () => {
    setError(null)
    try {
      const [s, sess, trend, dep] = await Promise.all([
        api.getStats(),
        api.getSessions(5),
        api.getBugsTrend(),
        api.getDependenciesHealth(),
      ])
      setStats(s)
      setSessions(sess)
      setTrendData(trend)
      setDepHealth(dep)
    } catch (err: any) {
      console.error('[Overview] Failed to load dashboard data:', err)
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <DashboardSkeleton />

  const healthScore = stats?.health_score ?? 85

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <MemoryHealthModal
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        autoCleanEnabled={autoCleanEnabled}
        onToggleAutoClean={handleToggleAutoClean}
      />

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">overview</h1>
          <p className="page-subtitle">repository health, memory usage, and recent debug sessions</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setHealthOpen(true)}
            style={{ fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            📊 memory health
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setLoading(true); loadData() }}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            ⟳ refresh
          </button>
        </div>
      </div>

      {/* Ingestion progress — auto-hides when idle */}
      <IngestProgress />

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <StatCard label="Total Sessions" value={stats?.total_sessions ?? 0} />
        <StatCard label="Open Bugs" value={stats?.open_bugs ?? 0} color="error" />
        <StatCard label="Memory Nodes" value={stats?.memory_nodes ?? 0} color="primary" />
        <StatCard label="Recalled Today" value={stats?.recalled_today ?? 0} />
        <StatCard
          label="Last Ingest"
          value={stats?.last_session ? formatRelativeSafe(stats.last_session) : '—'}
        />
      </div>

      {/* Circular Progress + Sub-metrics & Trend Chart Row */}
      <div className="grid-2" style={{ alignItems: 'stretch', gap: 'var(--space-6)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="card-header">
            <span className="card-title">repository health score</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', padding: 'var(--space-2) 0' }}>
            <CircularProgress value={healthScore} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <ProgressRow label="Code Quality" value={stats?.code_quality ?? 88} color="#2dd4bf" />
              <ProgressRow label="Test Coverage" value={stats?.test_coverage ?? 65} color="#eab308" />
              <ProgressRow label="Documentation" value={stats?.documentation ?? 92} color="#4ade80" />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
            Score is aggregated from open issues, code metrics, and memory nodes.
          </div>
        </div>

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
                <BugTrendChart labels={trendData.labels} opened={trendData.opened} closed={trendData.closed} />
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
                        {safeRepoName(s.repo || "")}
                      </span>
                      <span className="badge badge-default" style={{ fontSize: '10px' }}>{s.branch}</span>
                    </div>
                    {s.summary && (
                      <span
                        style={{
                          fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                          lineHeight: 1.4, display: '-webkit-box',
                          WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                        title={s.summary}
                      >{s.summary}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {formatRelativeSafe(s.started_at)}
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
        <LiveFeed />
      </div>

      {/* Dependency & System Health panel */}
      {depHealth && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card-header" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <span className="card-title">Dependency & System Health</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <span className="badge badge-default" style={{ fontSize: '10px' }}>{depHealth.total_dependencies} packages</span>
              {depHealth.outdated_count > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '10px' }}>{depHealth.outdated_count} outdated</span>
              )}
              {depHealth.vulnerable_count > 0 && (
                <span className="badge badge-error" style={{ fontSize: '10px' }}>{depHealth.vulnerable_count} vulnerable</span>
              )}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-5)',
            marginTop: 'var(--space-2)'
          }}>
            {/* Left Column: System Health Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                System Components
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {/* Row 1: Memory Graph */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <AnimatedGraphIcon />
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>Memory Graph</span>
                  </div>
                  <span className={`badge ${stats?.memory_nodes && stats.memory_nodes > 0 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '9px' }}>
                    {stats?.memory_nodes && stats.memory_nodes > 0 ? 'healthy' : 'degraded'}
                  </span>
                </div>

                {/* Row 2: Open Bugs */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <AnimatedBugIcon />
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>Open Bugs</span>
                  </div>
                  <span className={`badge ${stats?.open_bugs && stats.open_bugs > 0 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '9px' }}>
                    {stats?.open_bugs && stats.open_bugs > 0 ? 'degraded' : 'healthy'}
                  </span>
                </div>

                {/* Row 3: Session Continuity */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <AnimatedContinuityIcon />
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>Session Continuity</span>
                  </div>
                  <span className={`badge ${sessions.some(s => s.status === 'failed') ? 'badge-error' : 'badge-success'}`} style={{ fontSize: '9px' }}>
                    {sessions.some(s => s.status === 'failed') ? 'degraded' : 'healthy'}
                  </span>
                </div>

                {/* Row 4: Recall Latency */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <AnimatedLatencyIcon />
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>Recall Latency</span>
                  </div>
                  <span className={`badge ${isHealthy ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '9px' }}>
                    {isHealthy ? 'healthy' : 'degraded'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Outdated Packages OR System Diagnostics */}
            {depHealth.packages && depHealth.packages.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Outdated Packages
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {depHealth.packages.slice(0, 4).map(p => (
                    <div
                      key={p.name}
                      style={{
                        padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="mono" style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold' }}>{p.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>v{p.current_version}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>latest: v{p.latest_version}</span>
                        <span className={`badge ${
                          p.current_version !== p.latest_version ? 'badge-warning'
                          : 'badge-success'
                        }`} style={{ fontSize: '9px' }}>{p.current_version !== p.latest_version ? 'outdated' : 'ok'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  System Diagnostics
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', padding: 'var(--space-1) 0' }}>
                  {/* Circular SVG Gauge */}
                  <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                    <svg width="56" height="56" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke="var(--color-border)"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke="var(--color-primary)"
                        strokeWidth="3.5"
                        strokeDasharray={`${stats?.health_score ?? 100} 100`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text)'
                    }}>
                      {stats?.health_score ?? 100}%
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-text)' }}>
                      {(stats?.health_score ?? 100) >= 80 ? 'Optimal Operations' : 'Performance Warning'}
                    </span>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.4' }}>
                      All system dependencies are verified. Cognee memory graphs and local databases are operating within green parameters.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'primary' | 'success' | 'warning' | 'error' }) {
  const colorMap: Record<string, string> = {
    primary: 'var(--color-primary)', success: 'var(--color-success)',
    warning: 'var(--color-warning)', error: 'var(--color-error)',
  }
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div className="stat-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>{label}</div>
      <div className="stat-value" style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', color: color ? colorMap[color] : 'inherit' }}>{value}</div>
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="var(--color-border)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="transparent"
          stroke={value >= 80 ? '#2dd4bf' : value >= 50 ? '#eab308' : '#f87171'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="52%" textAnchor="middle" fill="var(--color-text)"
          style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}
        >{value}%</text>
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
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>{label}</span>
    </div>
  )
}
