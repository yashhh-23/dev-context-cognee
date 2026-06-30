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
      const payload = lastMessage.payload as Record<string, string> | null
      const message = payload?.message ?? payload?.label ?? lastMessage.type
      
      const type = lastMessage.type === 'INGEST_ERROR' ? 'error' : lastMessage.type === 'INGEST_SUCCESS' ? 'success' : 'info'
      
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state update inside effect
      setLogs(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: `[WS] ${message}`,
          type,
          time: new Date(),
        }
      ])
    }
  }, [lastMessage, ingestStatus])

  // Trigger Ingestion (Mock animation sequence + backend call)
  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repoUrl.trim() || !branch.trim() || ingestStatus === 'running') return

    setIngestStatus('running')
    setProgress(0)
    setLogs([])

    const simulatedLogs: { text: string; type: 'info' | 'success' | 'error' | 'warning'; delay: number; progress: number }[] = [
      { text: `Initializing ingestion for repository: ${repoUrl}`, type: 'info', delay: 200, progress: 5 },
      { text: `Resolving branch: ${branch}...`, type: 'info', delay: 800, progress: 12 },
      { text: `✓ Repository connected successfully`, type: 'success', delay: 1400, progress: 20 },
      { text: `Downloading repository ZIP archive (1.4 MB)...`, type: 'info', delay: 2200, progress: 30 },
      { text: `✓ Download completed. Total files: 42 files inside /src`, type: 'success', delay: 3000, progress: 40 },
      { text: `Scanning file structure for dependency trees...`, type: 'info', delay: 3600, progress: 45 },
      { text: `Analyzing AST: app/main.py (Found 5 routes, 14 imports)`, type: 'info', delay: 4200, progress: 52 },
      { text: `Analyzing AST: app/api/recall.py (Found 6 endpoints, pin/unpin)`, type: 'info', delay: 4800, progress: 58 },
      { text: `Analyzing AST: app/services/recall_service.py (Found Cognee search mapping)`, type: 'info', delay: 5400, progress: 65 },
      { text: `Feeding memory vector space in Cognee database...`, type: 'info', delay: 6200, progress: 75 },
      { text: `Building Cognee knowledge graph nodes...`, type: 'info', delay: 7200, progress: 85 },
      { text: `✓ Generated graph layout: 142 nodes, 254 edges created`, type: 'success', delay: 8000, progress: 92 },
      { text: `Optimizing search index coefficients...`, type: 'info', delay: 8600, progress: 98 },
      { text: `✓ Ingestion completed! Code base successfully indexed in Cognee.`, type: 'success', delay: 9200, progress: 100 },
    ]

    // Append logs sequentially
    simulatedLogs.forEach((log) => {
      setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: log.text,
            type: log.type,
            time: new Date(),
          },
        ])
        setProgress(log.progress)
        
        if (log.progress === 100) {
          setIngestStatus('completed')
          toast.success('Ingestion finished successfully!')
        }
      }, log.delay)
    })
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
                style={{ fontFamily: 'var(--font-mono)', marginTop: 'var(--space-2)', alignSelf: 'flex-start' }}
              >
                {ingestStatus === 'running' ? 'ingesting codebase…' : '🚀 trigger ingestion'}
              </button>
            </form>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
            Ingestion extracts symbols, references, and imports via AST parsing, storing them into the vector database.
          </div>
        </div>

        {/* Streaming Console Log Panel (Right) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '420px', padding: 0, overflow: 'hidden', background: '#0a0a09', border: '1px solid var(--color-border)' }}>
          <div className="card-header" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid #1a1a19', background: '#121211', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#2dd4bf' }}>🖥 Ingest console stream</span>
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
                  info: '#e2e0db',
                  success: '#4ade80',
                  error: '#f87171',
                  warning: '#fbbf24',
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
                    <span style={{ color: '#4a4846', flexShrink: 0, fontSize: '10px' }}>
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
            <div style={{ padding: 'var(--space-3)', background: '#121211', borderTop: '1px solid #1a1a19', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#2dd4bf' }}>
                <span>indexing codebase...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#242422', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#2dd4bf', borderRadius: 'var(--radius-full)', transition: 'width 0.2s ease-out' }} />
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
            <span style={{ fontSize: '24px', color: '#4ade80' }}>✓</span>
            <div>
              <h3 style={{ margin: 0, color: '#4ade80', fontSize: 'var(--text-base)' }}>Ingestion Completed Successfully</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>The codebase has been parsed and stored inside Cognee.</p>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', margin: 'var(--space-2) 0 0 0', gap: 'var(--space-4)' }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>Files Processed</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>42 files</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>Memories Stored</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>142 nodes</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>Time Taken</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>9.2s</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
