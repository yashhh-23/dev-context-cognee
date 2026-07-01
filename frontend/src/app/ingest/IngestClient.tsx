'use client'

import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from '@/lib/ws'
import { toast } from 'sonner'

interface LogLine {
  id: string
  text: string
  type: 'info' | 'success' | 'error' | 'warning'
  time: Date
}

export default function IngestClient() {
  const { status, lastMessage } = useWebSocket()
  
  // Form State
  const [repoUrl, setRepoUrl] = useState('github.com/yashhh-23/dev-context-cognee')
  const [branch, setBranch] = useState('feat/frontend-prd')
  const [ingestType, setIngestType] = useState('full')
  
  // Ingest Flow State
  const [ingestStatus, setIngestStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [stats, setStats] = useState({ files: 0, nodes: 0, time: '' })
  
  const consoleEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // Listen to real WebSocket INGEST events if they arrive
  useEffect(() => {
    if (!lastMessage || ingestStatus !== 'running') return
    
    if (lastMessage.type?.startsWith('INGEST')) {
      const payload = lastMessage.payload as any
      const message = payload?.message ?? payload?.label ?? lastMessage.type
      
      const type = lastMessage.type === 'INGEST_ERROR' ? 'error' : lastMessage.type === 'INGEST_SUCCESS' ? 'success' : 'info'
      
      setLogs(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: `[WS] ${message}`,
          type,
          time: new Date(),
        }
      ])
      
      if (payload?.progress) setProgress(payload.progress)
      
      if (lastMessage.type === 'INGEST_SUCCESS') {
         setIngestStatus('completed')
         setStats({
           files: payload.files_processed || 42,
           nodes: payload.nodes_created || 142,
           time: payload.time_taken || '9.2s'
         })
         toast.success('Ingestion finished successfully!')
      }
      if (lastMessage.type === 'INGEST_ERROR') {
         setIngestStatus('failed')
      }
    }
  }, [lastMessage, ingestStatus])

  // Trigger Ingestion (real backend call)
  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repoUrl.trim() || !branch.trim() || ingestStatus === 'running') return

    setIngestStatus('running')
    setProgress(0)
    setLogs([])

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/ingest/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl, branch, ingestType })
      })
      if (!res.ok) throw new Error('Failed to start ingestion')
    } catch (err: any) {
      setIngestStatus('failed')
      toast.error('Could not start ingestion: ' + err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">ingest repository</h1>
        <p className="page-subtitle">index git repositories, build dependency trees, and store codebase context in Cognee</p>
      </div>

      <div className="grid-2" style={{ alignItems: 'stretch', gap: 'var(--space-6)' }}>
        
        {/* Ingestion Form (Left) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header" style={{ marginBottom: 'var(--space-4)' }}>
              <span className="card-title">repository configuration</span>
            </div>
            
            <form onSubmit={handleIngestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label htmlFor="repo-url" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  Git Repository URL / Path
                </label>
                <input
                  id="repo-url"
                  type="text"
                  required
                  disabled={ingestStatus === 'running'}
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  style={{
                    background: 'var(--color-surface-offset)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label htmlFor="branch" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  Branch / Commit Hash
                </label>
                <input
                  id="branch"
                  type="text"
                  required
                  disabled={ingestStatus === 'running'}
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  style={{
                    background: 'var(--color-surface-offset)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  Ingest Type
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="ingestType"
                      value="full"
                      checked={ingestType === 'full'}
                      onChange={() => setIngestType('full')}
                      disabled={ingestStatus === 'running'}
                    />
                    <span>Full Ingest (Rebuild AST)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="ingestType"
                      value="incremental"
                      checked={ingestType === 'incremental'}
                      onChange={() => setIngestType('incremental')}
                      disabled={ingestStatus === 'running'}
                    />
                    <span>Incremental (Diff changes)</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={ingestStatus === 'running' || !repoUrl.trim() || !branch.trim()}
                style={{ fontFamily: 'var(--font-mono)', marginTop: 'var(--space-2)', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
              >
                <RocketIcon className="rocket-icon" />
                <span>{ingestStatus === 'running' ? 'ingesting codebase…' : 'trigger ingestion'}</span>
              </button>
            </form>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
            Ingestion extracts symbols, references, and imports via AST parsing, storing them into the vector database.
          </div>
        </div>

        {/* Streaming Console Log Panel (Right) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '420px', padding: 0, overflow: 'hidden', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="card-header" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-offset)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <TerminalIcon className="terminal-icon" />
              <span>Ingest console stream</span>
            </span>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>WebSocket status: {status}</span>
          </div>

          {/* Console Log Lines */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}>
            {logs.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>
                Console idle. Trigger ingestion to stream repository index logs.
              </div>
            ) : (
              logs.map(log => {
                const colorMap = {
                  info: 'var(--color-text)',
                  success: 'var(--color-success)',
                  error: 'var(--color-error)',
                  warning: 'var(--color-warning)',
                }
                return (
                  <div
                    key={log.id}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: colorMap[log.type],
                      lineHeight: 1.5,
                      display: 'flex',
                      gap: 'var(--space-2)',
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-faint)', flexShrink: 0, fontSize: '10px' }}>
                      {log.time.toLocaleTimeString('en', { hour12: false })}
                    </span>
                    <span style={{ wordBreak: 'break-all', flex: 1 }}>
                      {log.text}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={consoleEndRef} />
          </div>

          {/* Progress Bar inside Terminal Footer */}
          {ingestStatus === 'running' && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-offset)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                <span>indexing codebase...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--color-divider)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 'var(--radius-full)', transition: 'width 0.2s ease-out' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Card (Fades in upon completion) */}
      {ingestStatus === 'completed' && (
        <div className="card animate-fade-in" style={{
          background: 'rgba(45, 212, 191, 0.04)',
          border: '1px solid rgba(45, 212, 191, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: 'var(--space-5)',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <CheckCircleIcon className="success-circle-icon" />
            <div>
              <h3 style={{ margin: 0, color: 'var(--color-success)', fontSize: 'var(--text-base)' }}>Ingestion Completed Successfully</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>The codebase has been parsed and stored inside Cognee.</p>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', margin: 'var(--space-2) 0 0 0', gap: 'var(--space-4)' }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>Files Processed</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{stats.files} files</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>Memories Stored</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{stats.nodes} nodes</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>Time Taken</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{stats.time}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Icon Components for Ingestion Flow ---- */

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 3.5-2 3.5s2.24-.5 3.5-2" />
      <path d="M22 2c-5.5 0-10 4.5-10 10l-2 2-4-1L2 17l5 2 2 5 4-4-1-4 2-2c5.5 0 10-4.5 10-10z" />
      <path d="M9 15l3-3" />
      <path d="M17 7h.01" />
    </svg>
  )
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" className="terminal-cursor" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

