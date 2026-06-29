'use client'

import { useState } from 'react'
import { api, type RecallResult } from '@/lib/api'

export default function RecallPage() {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<RecallResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [memifyInput,  setMemifyInput]  = useState('')
  const [memifying,    setMemifying]    = useState(false)
  const [memifyStatus, setMemifyStatus] = useState<string | null>(null)
  const [forgetting,   setForgetting]   = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await api.recall(query.trim(), 12)
      setResults(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleForget(nodeId: string) {
    setForgetting(nodeId)
    try {
      await api.forget(nodeId)
      setResults(prev => prev.filter(r => r.id !== nodeId))
    } catch {
      // silently fail — show nothing
    } finally {
      setForgetting(null)
    }
  }

  async function handleMemify(e: React.FormEvent) {
    e.preventDefault()
    if (!memifyInput.trim()) return
    setMemifying(true)
    setMemifyStatus(null)
    try {
      const res = await api.memify(memifyInput.trim())
      setMemifyStatus(`Stored as node ${res.node_id}`)
      setMemifyInput('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setMemifyStatus(`Error: ${msg}`)
    } finally {
      setMemifying(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">recall</h1>
        <p className="page-subtitle">search, remember, and forget across Cognee memory</p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: 'var(--space-5)' }}>
        {/* Left: search + results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Search */}
          <form onSubmit={handleSearch}>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-2) var(--space-3)',
                alignItems: 'center',
              }}
            >
              <SearchIcon />
              <input
                type="text"
                placeholder="recall: what caused the auth bug?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={loading || !query.trim()}
                style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}
              >
                {loading ? '…' : 'recall'}
              </button>
            </div>
          </form>

          {/* Results */}
          {error && (
            <div style={{ color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              {error}
            </div>
          )}

          {!searched && !loading && (
            <div className="empty-state" style={{ padding: 'var(--space-10) var(--space-4)' }}>
              <div style={{ fontSize: '1.25rem', opacity: 0.3 }}>⌕</div>
              <h3>Search Cognee memory</h3>
              <p>Query sessions, bugs, file context, and concepts stored in memory.</p>
            </div>
          )}

          {loading && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton skeleton-text" style={{ width: `${50 + i * 10}%` }} />
                  <div className="skeleton skeleton-text" style={{ width: '90%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '70%' }} />
                </div>
              ))}
            </div>
          )}

          {searched && !loading && results.length === 0 && !error && (
            <div className="empty-state" style={{ padding: 'var(--space-10) var(--space-4)' }}>
              <h3>No results</h3>
              <p>Nothing in Cognee memory matches this query.</p>
            </div>
          )}

          {results.map(r => (
            <div key={r.id} className="card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="badge badge-info">{r.source}</span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-faint)',
                    }}
                  >
                    score: {r.score.toFixed(3)}
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleForget(r.id)}
                  disabled={forgetting === r.id}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: forgetting === r.id ? 'var(--color-text-faint)' : 'var(--color-error)',
                    fontSize: 'var(--text-xs)',
                  }}
                  title="Remove from Cognee memory"
                >
                  {forgetting === r.id ? 'forgetting…' : 'forget'}
                </button>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {r.content}
              </div>
              {r.created_at && (
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: memify panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">memify</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
              Store arbitrary context into Cognee memory. Use for important findings, decisions, or debug notes.
            </p>
            <form onSubmit={handleMemify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <textarea
                placeholder="e.g. The auth bug was caused by a missing await in middleware.ts line 42…"
                value={memifyInput}
                onChange={e => setMemifyInput(e.target.value)}
                rows={5}
                style={{
                  background: 'var(--color-surface-offset)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text)',
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: 1.7,
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={memifying || !memifyInput.trim()}
                style={{ fontFamily: 'var(--font-mono)', alignSelf: 'flex-start' }}
              >
                {memifying ? 'storing…' : 'store in cognee'}
              </button>
              {memifyStatus && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: memifyStatus.startsWith('Error') ? 'var(--color-error)' : 'var(--color-success)',
                  }}
                >
                  {memifyStatus}
                </div>
              )}
            </form>
          </div>

          {/* Memory actions info */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">memory actions</span>
            </div>
            {([
              ['recall',  'Vector search over all stored context'],
              ['forget',  'Remove a specific node from memory'],
              ['memify',  'Store new context into Cognee graph'],
              ['improve', 'Triggered automatically on session end'],
            ] as const).map(([action, desc]) => (
              <div key={action} className="item-row">
                <div>
                  <code style={{ fontSize: 'var(--text-xs)' }}>{action}()</code>
                  <div className="item-meta" style={{ marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ color: 'var(--color-text-faint)', flexShrink: 0 }}>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  )
}
