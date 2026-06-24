'use client'

import { useEffect, useState } from 'react'
import { api, type Bug } from '@/lib/api'

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const

export default function BugsPage() {
  const [bugs,         setBugs]         = useState<Bug[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [selectedBug,  setSelectedBug]  = useState<Bug | null>(null)
  const [recalling,    setRecalling]    = useState(false)
  const [recallResult, setRecallResult] = useState<string | null>(null)
  const [filter,       setFilter]       = useState<'all' | typeof SEVERITY_ORDER[number]>('all')

  useEffect(() => {
    api.getBugs(30)
      .then(setBugs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleRecall(bug: Bug) {
    setSelectedBug(bug)
    setRecallResult(null)
    setRecalling(true)
    try {
      const res = await api.recallBugContext(bug.id)
      setRecallResult(res.context)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setRecallResult(`Error: ${msg}`)
    } finally {
      setRecalling(false)
    }
  }

  const filtered = filter === 'all'
    ? bugs
    : bugs.filter(b => b.severity === filter)

  const counts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = bugs.filter(b => b.severity === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">bugs</h1>
            <p className="page-subtitle">open issues from GitHub, enriched with Cognee memory recall</p>
          </div>
          <span className="badge badge-error" style={{ marginBottom: 'var(--space-1)' }}>
            {bugs.length} open
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${bugs.length})`} />
        {SEVERITY_ORDER.map(s => (
          <FilterTab
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={`${s} (${counts[s] ?? 0})`}
          />
        ))}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Bug list */}
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 'var(--space-4)' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="item-row">
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text" style={{ width: `${60 + i * 5}%` }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  </div>
                  <div className="skeleton" style={{ width: 52, height: 20, borderRadius: 'var(--radius-full)' }} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 'var(--space-4)', color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No {filter === 'all' ? '' : filter} bugs</h3>
              <p>All clear for this severity.</p>
            </div>
          ) : (
            <div style={{ padding: '0 var(--space-4)' }}>
              {filtered.map(bug => (
                <div
                  key={bug.id}
                  className="item-row"
                  style={{
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-2)',
                    background: selectedBug?.id === bug.id ? 'var(--color-surface-offset)' : 'transparent',
                    marginInline: 'calc(-1 * var(--space-2))',
                  }}
                  onClick={() => handleRecall(bug)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="item-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      #{bug.id} {bug.title}
                    </div>
                    <div className="item-meta">
                      {bug.author} · {formatRelative(bug.created)}
                    </div>
                  </div>
                  <SeverityBadge severity={bug.severity} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recall panel */}
        <div className="card" style={{ position: 'sticky', top: 'calc(var(--topbar-height) + var(--space-6))' }}>
          <div className="card-header">
            <span className="card-title">cognee recall</span>
            {selectedBug && (
              <a
                href={selectedBug.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                view on github ↗
              </a>
            )}
          </div>

          {!selectedBug ? (
            <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-4)' }}>
              <div style={{ fontSize: '1.25rem', opacity: 0.3 }}>⌖</div>
              <h3>Select a bug</h3>
              <p>Click any issue to recall related context from Cognee memory.</p>
            </div>
          ) : recalling ? (
            <div style={{ padding: 'var(--space-4)' }}>
              <div className="skeleton skeleton-heading" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" style={{ width: '70%' }} />
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <div className="item-title" style={{ fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-1)' }}>
                  #{selectedBug.id} {selectedBug.title}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <SeverityBadge severity={selectedBug.severity} />
                  {selectedBug.labels.map(l => (
                    <span key={l} className="badge badge-default">{l}</span>
                  ))}
                </div>
              </div>
              <div className="divider" />
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: 'var(--color-surface-offset)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '320px',
                  overflowY: 'auto',
                }}
              >
                {recallResult ?? 'No context found in memory.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: Bug['severity'] }) {
  const map: Record<Bug['severity'], string> = {
    critical: 'badge-error',
    high:     'badge-warning',
    medium:   'badge-info',
    low:      'badge-default',
  }
  return <span className={`badge ${map[severity]}`}>{severity}</span>
}

function FilterTab({
  active, onClick, label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={active ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
      style={{
        fontFamily: 'var(--font-mono)',
      }}
    >
      {label}
    </button>
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
