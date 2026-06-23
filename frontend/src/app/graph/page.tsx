'use client'

import { useEffect, useRef, useState } from 'react'
import { api, type GraphData } from '@/lib/api'

// Must match graph_builder.py NODE_COLORS keys exactly
const NODE_COLORS: Record<string, string> = {
  project:      '#58a6ff',  // blue
  bug:          '#f85149',  // red
  dependency:   '#d29922',  // yellow
  fix:          '#3fb950',  // green
  github_issue: '#bc8cff',  // purple
}

const NODE_SHAPES: Record<string, string> = {
  project:      'dot',
  bug:          'diamond',
  dependency:   'triangle',
  fix:          'square',
  github_issue: 'star',
}

const LEGEND: [string, string][] = [
  ['project',      '#58a6ff'],
  ['bug',          '#f85149'],
  ['dependency',   '#d29922'],
  ['fix',          '#3fb950'],
  ['github_issue', '#bc8cff'],
]

export default function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [building,  setBuilding]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const containerRef              = useRef<HTMLDivElement>(null)
  const networkRef                = useRef<unknown>(null)

  useEffect(() => {
    loadGraph()
  }, [])

  async function loadGraph() {
    setLoading(true)
    try {
      const data = await api.getGraph()
      setGraphData(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuild() {
    setBuilding(true)
    setError(null)
    try {
      await api.buildGraph()
      await loadGraph()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBuilding(false)
    }
  }

  // Mount vis.js network when data is ready
  useEffect(() => {
    if (!graphData || !containerRef.current) return
    if (graphData.nodes.length === 0) return

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js'
    script.onload = () => {
      if (!containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vis = (window as any).vis

      const nodes = new vis.DataSet(
        graphData.nodes.map(n => ({
          id:    n.id,
          label: n.label.length > 20 ? n.label.slice(0, 18) + '\u2026' : n.label,
          title: n.label,   // full tooltip on hover
          color: {
            background: NODE_COLORS[n.type] ?? '#7a7874',
            border:     'transparent',
            highlight:  { background: '#fff', border: '#2dd4bf' },
          },
          font:  { color: '#e2e0db', size: 11, face: 'Geist Mono, monospace' },
          size:  (n.size ?? 10) + 8,
          shape: NODE_SHAPES[n.type] ?? 'dot',
        }))
      )

      const edges = new vis.DataSet(
        graphData.edges.map((e, i) => ({
          id:     i,
          from:   e.source,
          to:     e.target,
          label:  e.label ?? '',
          width:  (e.weight ?? 1) * 1.5,
          color:  { color: '#3a3a38', highlight: '#2dd4bf' },
          font:   { size: 9, color: '#6b6966', face: 'Geist Mono, monospace', align: 'middle' },
          smooth: { type: 'curvedCW', roundness: 0.2 },
        }))
      )

      const options = {
        physics: {
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -30, springLength: 100 },
          stabilization: { iterations: 120 },
        },
        interaction: { hover: true, tooltipDelay: 200 },
        nodes: { borderWidth: 0, shadow: false },
        edges: { arrows: { to: { enabled: true, scaleFactor: 0.5 } } },
      }

      if (networkRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(networkRef.current as any).destroy()
      }
      networkRef.current = new vis.Network(containerRef.current, { nodes, edges }, options)
    }
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [graphData])

  const nodeTypeCount = graphData
    ? graphData.nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
    : {}

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">memory graph</h1>
            <p className="page-subtitle">Cognee knowledge graph — nodes, edges, and relationships</p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBuild}
            disabled={building}
            style={{ marginBottom: 'var(--space-1)', fontFamily: 'var(--font-mono)' }}
          >
            {building ? 'building\u2026' : '\u27f3 rebuild graph'}
          </button>
        </div>
      </div>

      {/* Legend + stats */}
      {graphData && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          {LEGEND.map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
                {type} ({nodeTypeCount[type] ?? 0})
              </span>
            </div>
          ))}
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', marginLeft: 'auto' }}>
            {graphData.nodes.length} nodes · {graphData.edges.length} edges
          </span>
        </div>
      )}

      {/* Graph canvas */}
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden', height: '520px', position: 'relative' }}
      >
        {loading ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          }}>
            loading graph\u2026
          </div>
        ) : error ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
            padding: 'var(--space-6)',
          }}>
            {error}
          </div>
        ) : !graphData || graphData.nodes.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '1.5rem', opacity: 0.3 }}>\u2b21</div>
            <h3>No graph data</h3>
            <p>Click &ldquo;rebuild graph&rdquo; to process your sessions into Cognee memory.</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', background: 'var(--color-bg)' }}
          />
        )}
      </div>
    </div>
  )
}
