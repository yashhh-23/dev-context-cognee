'use client'

import { useEffect, useState } from 'react'
import { api, type ContributeIssue } from '@/lib/api'

export default function ContributePage() {
  const [issues,  setIssues]  = useState<ContributeIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<'all' | 'good-first-issue' | 'stale-pr' | 'help-wanted'>('all')
  const [suggesting, setSuggesting] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Record<number, string>>({})

  useEffect(() => {
    api.getContributions()
      .then(setIssues)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSuggest(issue: ContributeIssue) {
    if (suggestions[issue.id]) return
    setSuggesting(issue.id)
    try {
      const res = await api.suggestContribution(issue.id)
      setSuggestions(prev => ({ ...prev, [issue.id]: res.suggestion }))
    } catch {
      setSuggestions(prev => ({ ...prev, [issue.id]: 'Could not generate suggestion.' }))
    } finally {
      setSuggesting(null)
    }
  }

  const filtered = tab === 'all'
    ? issues
    : issues.filter(i => i.type === tab)

  const counts = {
    'good-first-issue': issues.filter(i => i.type === 'good-first-issue').length,
    'stale-pr':         issues.filter(i => i.type === 'stale-pr').length,
    'help-wanted':      issues.filter(i => i.type === 'help-wanted').length,
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Contribute</h1>
        <p className="page-subtitle">good-first issues, stale PRs, and Cognee-suggested entry points</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        {(['all', 'good-first-issue', 'stale-pr', 'help-wanted'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {t === 'all' ? `all (${issues.length})` : `${t} (${counts[t]})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="item-row">
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: `${55 + i * 8}%` }} />
                <div className="skeleton skeleton-text" style={{ width: '35%' }} />
              </div>
              <div className="skeleton" style={{ width: 64, height: 22, borderRadius: 'var(--radius-full)' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing here</h3>
          <p>No {tab === 'all' ? '' : tab} opportunities right now.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filtered.map(issue => (
            <ContributeCard
              key={issue.id}
              issue={issue}
              suggestion={suggestions[issue.id]}
              suggesting={suggesting === issue.id}
              onSuggest={() => handleSuggest(issue)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ContributeCard({
  issue, suggestion, suggesting, onSuggest,
}: {
  issue: ContributeIssue
  suggestion?: string
  suggesting: boolean
  onSuggest: () => void
}) {
  const typeColor: Record<ContributeIssue['type'], string> = {
    'good-first-issue': 'badge-success',
    'stale-pr':         'badge-warning',
    'help-wanted':      'badge-info',
  }
  const diffColor: Record<ContributeIssue['difficulty'], string> = {
    easy:   'badge-success',
    medium: 'badge-warning',
    hard:   'badge-error',
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="item-title"
            style={{ fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}
          >
            {issue.title}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-1)' }}>
            <span className={`badge ${typeColor[issue.type]}`}>{issue.type}</span>
            <span className={`badge ${diffColor[issue.difficulty]}`}>{issue.difficulty}</span>
            <span className="badge badge-default mono">{issue.repo}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onSuggest}
            disabled={suggesting || !!suggestion}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {suggesting ? 'recalling…' : suggestion ? 'recalled ✓' : 'cognee recall'}
          </button>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            view ↗
          </a>
        </div>
      </div>

      {suggestion && (
        <>
          <div className="divider" />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.7,
              background: 'var(--color-surface-offset)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span style={{ color: 'var(--color-primary)', marginRight: 'var(--space-2)' }}>›</span>
            {suggestion}
          </div>
        </>
      )}
    </div>
  )
}
