'use client'

import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'

interface MemoryHealthData {
  total_nodes: number
  pinned_nodes: number
  decaying_nodes: number
  topics: { name: string; count: number }[]
  health_score: number
  last_clean_removed: number
  cognee_version: string
}

interface AutoCleanResult {
  removed: number
  kept: number
  clusters: number
  message?: string
  error?: string
}

interface Props {
  open: boolean
  onClose: () => void
  autoCleanEnabled: boolean
  onToggleAutoClean: (v: boolean) => void
}

export default function MemoryHealthModal({ open, onClose, autoCleanEnabled, onToggleAutoClean }: Props) {
  const [data, setData] = useState<MemoryHealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<AutoCleanResult | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setCleanResult(null)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/stats/memory-health`)
      .then(r => r.json())
      .then((d: MemoryHealthData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [open])

  const handleManualClean = async () => {
    setCleaning(true)
    setCleanResult(null)
    try {
      const res = await api.autoCleanMemories()
      setCleanResult({
        removed: res.cleaned_count,
        kept: 0,
        clusters: 0,
        message: res.message,
      })
      // refresh health stats
      const d: MemoryHealthData = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/stats/memory-health`
      ).then(r => r.json())
      setData(d)
    } catch {
      setCleanResult({ removed: 0, kept: 0, clusters: 0, error: 'Clean failed' })
    } finally {
      setCleaning(false)
    }
  }

  if (!open) return null

  const score = data?.health_score ?? 0
  const scoreColor = score >= 80 ? '#4ade80' : score >= 50 ? '#eab308' : '#f87171'
  const maxTopic = data?.topics?.length ? Math.max(...data.topics.map(t => t.count), 1) : 1

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
        padding: 'var(--space-6)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-base)' }}>
             Memory health
            </span>
            {data?.cognee_version && (
              <span className="badge badge-default" style={{ fontSize: '9px' }}>
                cognee {data.cognee_version}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-faint)', fontSize: '1.1rem', lineHeight: 1,
              padding: '2px 6px',
            }}
          >×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
            ⟳ loading cognee memory stats…
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
            could not reach backend
          </div>
        ) : (
          <>
            {/* Score + KPI row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
              {/* Big score ring */}
              <svg width={88} height={88} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
                <circle cx={44} cy={44} r={36} fill="none" stroke="var(--color-border)" strokeWidth={8} />
                <circle
                  cx={44} cy={44} r={36} fill="none"
                  stroke={scoreColor} strokeWidth={8}
                  strokeDasharray={2 * Math.PI * 36}
                  strokeDashoffset={2 * Math.PI * 36 * (1 - score / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
                <text x="50%" y="54%" textAnchor="middle" fill="var(--color-text)"
                  style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                >{score}%</text>
              </svg>
              {/* KPI pills */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <KpiPill label="Total nodes" value={data.total_nodes} color="var(--color-primary)" />
                <KpiPill label="Pinned" value={data.pinned_nodes} color="#eab308" />
                <KpiPill label="Decaying" value={data.decaying_nodes} color="#f87171" />
                <KpiPill label="Last clean removed" value={data.last_clean_removed} color="#4ade80" />
              </div>
            </div>

            {/* Topic distribution */}
            {data.topics && data.topics.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginBottom: 'var(--space-2)' }}>
                  Memory by topic
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {data.topics.map(t => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', width: 100, flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </span>
                      <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(t.count / maxTopic) * 100}%`,
                          height: '100%',
                          background: 'var(--color-primary)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-faint)', width: 24, textAlign: 'right' }}>
                        {t.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-clean toggle */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                  Auto-clean on dashboard load
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>
                  never removes pinned memories
                </span>
              </div>
              <button
                onClick={() => onToggleAutoClean(!autoCleanEnabled)}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: autoCleanEnabled ? 'var(--color-primary)' : 'var(--color-border)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: autoCleanEnabled ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Manual clean button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <button
                onClick={handleManualClean}
                disabled={cleaning}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                  padding: 'var(--space-2) var(--space-4)',
                  background: cleaning ? 'var(--color-border)' : 'var(--color-primary)',
                  color: cleaning ? 'var(--color-text-faint)' : '#000',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: cleaning ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  justifyContent: 'center',
                }}
              >
                {cleaning ? '⟳ scanning cognee graph…' : '✦ run memory clean now'}
              </button>
              {cleanResult && (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: cleanResult.error ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
                  color: cleanResult.error ? '#f87171' : '#4ade80',
                  border: `1px solid ${cleanResult.error ? '#f87171' : '#4ade80'}`,
                  textAlign: 'center',
                }}>
                  {cleanResult.error
                    ? `⚠ ${cleanResult.error}`
                    : cleanResult.message
                      ? `✓ ${cleanResult.message}`
                      : cleanResult.removed === 0
                        ? '✓ memory is clean — no duplicates found'
                        : `✓ removed ${cleanResult.removed} duplicates across ${cleanResult.clusters} cluster${cleanResult.clusters !== 1 ? 's' : ''} — ${cleanResult.kept} nodes kept`
                  }
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KpiPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: 'var(--space-2) var(--space-3)',
      background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
    }}>
      <span style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</span>
    </div>
  )
}
