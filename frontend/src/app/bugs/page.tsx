'use client'

import { useEffect, useState } from 'react'
import { api, type Bug } from '@/lib/api'
import { formatRelativeSafe } from '@/lib/utils'

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const

export default function BugsPage() {
  const [bugs,         setBugs]         = useState<Bug[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [selectedBug,  setSelectedBug]  = useState<Bug | null>(null)
  const [recalling,    setRecalling]    = useState(false)
  const [recallResult, setRecallResult] = useState<string | null>(null)
  const [filter,       setFilter]       = useState<'all' | typeof SEVERITY_ORDER[number]>('all')
  const [totalBugs,    setTotalBugs]    = useState(0)
  const [globalCounts, setGlobalCounts] = useState<Record<string, number>>({})
  const [feedbackApplied, setFeedbackApplied] = useState<Record<string, boolean>>({})
  
  const [page,         setPage]         = useState(1)
  const [hasMore,      setHasMore]      = useState(true)

  async function submitBugFeedback(e: React.MouseEvent, bugId: string, score: number) {
    e.stopPropagation()
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recall/feedback`
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qa_id: bugId, score })
      })
      setFeedbackApplied(prev => ({ ...prev, [bugId]: true }))
    } catch (err) {
      console.error('Feedback error:', err)
    }
  }

  useEffect(() => {
    setLoading(true)
    api.getBugs(100, page)
      .then(res => {
        setBugs(res.bugs)
        setTotalBugs(res.total)
        setGlobalCounts(res.counts)
        setHasMore(res.bugs.length > 0)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

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

  return (
    <div className="split-layout-container">
      <div className="page-header" style={{ flexShrink: 0, marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">bugs</h1>
            <p className="page-subtitle">open issues from GitHub, enriched with Cognee memory recall</p>
          </div>
          <span className="badge badge-error" style={{ marginBottom: 'var(--space-1)' }}>
            {totalBugs} open
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', flexShrink: 0 }}>
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${totalBugs})`} />
        {SEVERITY_ORDER.map(s => (
          <FilterTab
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={`${s} (${globalCounts[s] ?? 0})`}
          />
        ))}
      </div>

      <div className="grid-2 split-layout-grid">
        {/* Bug list */}
        <div className="card split-layout-card" style={{ padding: 0 }}>
          <div className="split-layout-scrollable" style={{ padding: '0 var(--space-4)' }}>
            {loading ? (
              <div style={{ padding: 'var(--space-4) 0' }}>
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
              <div style={{ padding: 'var(--space-4) 0', color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <h3>No {filter === 'all' ? '' : filter} bugs</h3>
                <p>All clear for this severity.</p>
              </div>
            ) : (
              filtered.map(bug => (
                <div
                  key={bug.id}
                  className="item-row"
                  style={{
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-2)',
                    background: selectedBug?.id === bug.id ? 'var(--color-surface-offset)' : 'transparent',
                    marginInline: 'calc(-1 * var(--space-2))',
                    transition: 'background var(--transition)',
                  }}
                  onClick={() => handleRecall(bug)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="item-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      #{bug.id} {bug.title}
                    </div>
                    <div className="item-meta">
                      {bug.author} · {formatRelativeSafe(bug.created)}
                    </div>
                    
                    {/* Feedback Rating Bar */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                      {feedbackApplied[String(bug.id)] ? (
                        <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 500 }}>✓ Feedback applied</span>
                      ) : (
                        <>
                          <button
                            onClick={(e) => submitBugFeedback(e, String(bug.id), 1)}
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: '10px', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}
                          >
                            [👍 Helpful]
                          </button>
                          <button
                            onClick={(e) => submitBugFeedback(e, String(bug.id), -1)}
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: '10px', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}
                          >
                            [👎 Unhelpful]
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <SeverityBadge severity={bug.severity} />
                </div>
              ))
            )}
            
            {/* Pagination Controls */}
            {!loading && !error && (filtered.length > 0 || page > 1) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4) 0', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  &larr; Previous Page
                </button>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
                  Page {page}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Next Page &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recall panel */}
        <div className="card split-layout-card">
          <div className="card-header" style={{ flexShrink: 0, marginBottom: 'var(--space-3)' }}>
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

          <div className="split-layout-scrollable" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!selectedBug ? (
              <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-4)', flex: 1 }}>
                <div style={{ fontSize: '1.25rem', opacity: 0.3 }}>⌖</div>
                <h3>Select a bug</h3>
                <p>Click any issue to recall related context from Cognee memory.</p>
              </div>
            ) : recalling ? (
              <div style={{ padding: 'var(--space-2) 0', flex: 1 }}>
                <div className="skeleton skeleton-heading" style={{ width: '80%', height: '1.2rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '90%', marginTop: 'var(--space-2)' }} />
                <div className="skeleton skeleton-text" style={{ width: '85%' }} />
                <div className="skeleton skeleton-text" style={{ width: '70%' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ marginBottom: 'var(--space-3)', flexShrink: 0 }}>
                  <div className="item-title" style={{
                    fontFamily: 'var(--font-mono)',
                    marginBottom: 'var(--space-2)',
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.4,
                    fontWeight: 500,
                    wordBreak: 'break-word',
                  }}>
                    #{selectedBug.id} {selectedBug.title}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <SeverityBadge severity={selectedBug.severity} />
                    {selectedBug.labels.map(l => (
                      <span key={l} className="badge badge-default">{l}</span>
                    ))}
                  </div>
                </div>
                <div className="divider" style={{ flexShrink: 0, margin: '0 0 var(--space-4) 0' }} />
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
                    flex: 1,
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {recallResult ?? 'No context found in memory.'}
                </div>
              </div>
            )}
          </div>
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
