'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type GraphData, type RecallResult } from '@/lib/api'
import { toast } from 'sonner'

// Must match graph_builder.py NODE_COLORS keys exactly
const NODE_COLORS: Record<string, string> = {
  project:      '#38bdf8',  // light blue
  bug:          '#f87171',  // red
  dependency:   '#fbbf24',  // yellow
  fix:          '#4ade80',  // green
  github_issue: '#c084fc',  // purple
}

const NODE_SHAPES: Record<string, string> = {
  project:      'dot',
  bug:          'diamond',
  dependency:   'triangle',
  fix:          'square',
  github_issue: 'star',
}

const LEGEND: [string, string][] = [
  ['project',      '#38bdf8'],
  ['bug',          '#f87171'],
  ['dependency',   '#fbbf24'],
  ['fix',          '#4ade80'],
  ['github_issue', '#c084fc'],
]

export default function GraphClient() {
  const [viewMode, setViewMode] = useState<'graph' | 'grid'>('graph')
  
  // Graph States
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [graphLoading, setGraphLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)
  
  // Memory Stats States
  const [stats, setStats] = useState<{ total_memories: number; graph_nodes: number; graph_edges: number; last_updated: string } | null>(null)
  
  // Grid View States
  const [memories, setMemories] = useState<RecallResult[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<any>(null)

  // Fetch memory statistics
  const fetchStats = async () => {
    try {
      const s = await api.getMemoryStats()
      setStats(s)
    } catch {
      // ignore
    }
  }

  // Load Graph Data
  const loadGraph = useCallback(async () => {
    setGraphLoading(true)
    setGraphError(null)
    try {
      const data = await api.getGraph()
      setGraphData(data)
    } catch (e: any) {
      setGraphError(e.message || 'Failed to load graph')
    } finally {
      setGraphLoading(false)
    }
  }, [])

  // Load Memories for Grid View
  const loadMemories = useCallback(async (query = '') => {
    setGridLoading(true)
    try {
      const res = await api.recall(query, 50)
      setMemories(res)
    } catch {
      toast.error('Failed to load memories')
    } finally {
      setGridLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial stats fetch
    fetchStats()
    loadGraph()
  }, [loadGraph])

  useEffect(() => {
    if (viewMode === 'grid') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state update inside effect
      loadMemories(searchQuery)
    }
  }, [viewMode, searchQuery, loadMemories])

  // Rebuild Graph
  async function handleBuild() {
    setBuilding(true)
    try {
      const res = await api.buildGraph()
      toast.success(res.message || 'Graph rebuilt successfully!')
      await Promise.all([fetchStats(), loadGraph()])
    } catch (e: any) {
      toast.error(e.message || 'Failed to build graph')
    } finally {
      setBuilding(false)
    }
  }

  // Pin Toggle (Grid view)
  async function handlePinToggle(nodeId: string, currentlyPinned?: boolean) {
    try {
      if (currentlyPinned) {
        await api.unpin(nodeId)
        setMemories(prev => prev.map(m => m.id === nodeId ? { ...m, pinned: false } : m))
        toast.success('Memory node unpinned')
      } else {
        await api.pin(nodeId)
        setMemories(prev => prev.map(m => m.id === nodeId ? { ...m, pinned: true } : m))
        toast.success('Memory node pinned')
      }
      fetchStats()
    } catch {
      toast.error('Pin operation failed')
    }
  }

  // Forget memory (Grid view)
  async function handleForget(nodeId: string) {
    try {
      await api.forget(nodeId)
      setMemories(prev => prev.filter(m => m.id !== nodeId))
      toast.success('Memory node forgotten')
      fetchStats()
    } catch (err: any) {
      toast.error(err.message || 'Forget operation failed')
    }
  }

  // Edit/Improve memory
  const [editingNode, setEditingNode] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  // Selected node and connected edges states for graph inspector
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [connectedEdges, setConnectedEdges] = useState<any[]>([])

  async function handleEditSubmit(nodeId: string) {
    if (!editVal.trim()) return
    try {
      await api.memify(`Updated memory: ${editVal.trim()}`)
      setMemories(prev => prev.map(m => m.id === nodeId ? { ...m, content: editVal.trim() } : m))
      setEditingNode(null)
      setEditVal('')
      toast.success('Memory improved and updated!')
      fetchStats()
    } catch {
      toast.error('Failed to update memory')
    }
  }

  // Mount vis.js network when viewMode is 'graph' and data is ready
  useEffect(() => {
    if (viewMode !== 'graph' || !graphData || !containerRef.current) return
    if (graphData.nodes.length === 0) return

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js'
    script.onload = () => {
      if (!containerRef.current) return
      const vis = (window as any).vis

      const rootStyle = getComputedStyle(document.documentElement)
      const textColor = rootStyle.getPropertyValue('--color-text').trim() || '#1c1b1a'
      const textFaint = rootStyle.getPropertyValue('--color-text-faint').trim() || '#6b6966'

      const nodes = new vis.DataSet(
        graphData.nodes.map(n => ({
          id:    n.id,
          label: n.label.length > 20 ? n.label.slice(0, 18) + '\u2026' : n.label,
          title: n.label,
          color: {
            background: NODE_COLORS[n.type] ?? '#7a7874',
            border:     'transparent',
            highlight:  { background: '#fff', border: '#2dd4bf' },
          },
          font:  { color: textColor, size: 11, face: 'Geist Mono, monospace' },
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
          color:  { color: textFaint, highlight: '#2dd4bf' },
          font:   { size: 9, color: textFaint, face: 'Geist Mono, monospace', align: 'middle' },
          smooth: { type: 'curvedCW', roundness: 0.2 },
        }))
      )

      const options = {
        physics: {
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -40, springLength: 120 },
          stabilization: { iterations: 150 },
        },
        interaction: { hover: true, tooltipDelay: 200 },
        nodes: { borderWidth: 0, shadow: false },
        edges: { arrows: { to: { enabled: true, scaleFactor: 0.5 } } },
      }

      if (networkRef.current) {
        ;(networkRef.current as any).destroy()
      }
      const network = new vis.Network(containerRef.current, { nodes, edges }, options)
      networkRef.current = network

      network.on('selectNode', (params: any) => {
        const selectedId = params.nodes[0]
        const node = graphData.nodes.find(n => n.id === selectedId)
        if (node) {
          const connected = graphData.edges.filter(e => e.source === selectedId || e.target === selectedId)
          setSelectedNode(node)
          setConnectedEdges(connected)
        }
      })

      network.on('deselectNode', () => {
        setSelectedNode(null)
        setConnectedEdges([])
      })
    }
    document.head.appendChild(script)
    return () => { 
      script.remove() 
      setSelectedNode(null)
      setConnectedEdges([])
    }
  }, [viewMode, graphData])

  const nodeTypeCount = graphData
    ? graphData.nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
    : {}

  // Filter memories by category (Grid view)
  const filteredMemories = memories.filter(m => {
    if (selectedCategory === 'all') return true
    if (selectedCategory === 'pinned') return !!m.pinned
    return m.source.toLowerCase().includes(selectedCategory)
  })

  // Expandable card state
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 0 }}>
        <div>
          <h1 className="page-title">memory graph & manager</h1>
          <p className="page-subtitle">Cognee knowledge graph, interactive node network, and memory card manager</p>
        </div>
        
        {/* Toggle & Rebuild */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBuild}
            disabled={building}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {building ? 'building…' : '⟳ rebuild graph'}
          </button>

          <div style={{
            display: 'flex',
            background: 'var(--color-surface-offset)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}>
            <button
              className={`btn btn-sm ${viewMode === 'graph' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('graph')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              <NetworkIcon size={12} />
              <span>Graph View</span>
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('grid')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              <TableIcon size={12} />
              <span>Grid View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Memories</div>
          <div className="stat-value">{stats?.total_memories ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Graph Nodes</div>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>{stats?.graph_nodes ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Graph Edges</div>
          <div className="stat-value" style={{ color: '#a78bfa' }}>{stats?.graph_edges ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Updated</div>
          <div className="stat-value" style={{ fontSize: 'var(--text-sm)', marginTop: '6px' }}>
            {stats?.last_updated ? new Date(stats.last_updated).toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {/* VIEW 1: GRAPH VIEW */}
      {viewMode === 'graph' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Legend + stats */}
          {graphData && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
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

          {/* Graph Canvas */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', height: '520px', position: 'relative' }}>
            {graphLoading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                loading knowledge graph…
              </div>
            ) : graphError ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                {graphError}
              </div>
            ) : !graphData || graphData.nodes.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '1.5rem', opacity: 0.3 }}>⬡</div>
                <h3>No graph data</h3>
                <p>Click &ldquo;rebuild graph&rdquo; to parse sessions into Cognee memory nodes.</p>
              </div>
            ) : (
              <div ref={containerRef} style={{ width: '100%', height: '100%', background: 'var(--color-bg)' }} />
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: GRID VIEW (Memory Manager) */}
      {viewMode === 'grid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          {/* Search & Category filter row */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{
              flex: 1,
              minWidth: '240px',
              display: 'flex',
              gap: 'var(--space-2)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              alignItems: 'center',
            }}>
              <span style={{ color: 'var(--color-text-faint)' }}>⌕</span>
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text)',
                }}
              />
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Memories' },
                { id: 'pinned', label: '📌 Pinned' },
                { id: 'file', label: '📄 Code Files' },
                { id: 'bug', label: '🐞 Bugs' },
                { id: 'session', label: '⌗ Sessions' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    background: selectedCategory === cat.id ? 'var(--color-primary)' : 'var(--color-surface-offset)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    padding: '4px 12px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: selectedCategory === cat.id ? 'var(--color-bg)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid memory list */}
          {gridLoading ? (
            <div className="grid-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '90%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '70%' }} />
                </div>
              ))}
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
              <h3>No memories found</h3>
              <p>No memory nodes match the selected search and filter criteria.</p>
            </div>
          ) : (
            <div className="grid-3 animate-fade-in" style={{ alignItems: 'start' }}>
              {filteredMemories.map(m => {
                const isExpanded = !!expandedCards[m.id]
                const isEditing = editingNode === m.id
                
                return (
                  <div
                    key={m.id}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      animation: 'fadeIn 0.2s ease-out',
                      position: 'relative',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-info" style={{ fontSize: '9px' }}>{m.source}</span>
                      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => handlePinToggle(m.id, m.pinned)}
                          style={{
                            fontSize: '9px',
                            color: m.pinned ? 'var(--color-primary)' : 'var(--color-text-faint)',
                            padding: '1px 4px',
                          }}
                          title={m.pinned ? 'Unpin memory' : 'Pin memory'}
                        >
                          {m.pinned ? '📌' : '📍'}
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleForget(m.id)}
                          disabled={m.pinned}
                          style={{
                            fontSize: '9px',
                            color: m.pinned ? 'var(--color-text-faint)' : 'var(--color-error)',
                            padding: '1px 4px',
                            cursor: m.pinned ? 'not-allowed' : 'pointer',
                          }}
                          title={m.pinned ? 'Unpin to forget' : 'Forget memory'}
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    {/* Editable / Content Area */}
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                        <textarea
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          rows={4}
                          style={{
                            width: '100%',
                            background: 'var(--color-surface-offset)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: 'var(--space-2)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-text)',
                            outline: 'none',
                            resize: 'vertical',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleEditSubmit(m.id)}
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            save
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setEditingNode(null)}
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          lineHeight: 1.6,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          // Truncate logic
                          display: isExpanded ? 'block' : '-webkit-box',
                          WebkitLineClamp: isExpanded ? 'unset' : 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: isExpanded ? 'visible' : 'hidden',
                        }}>
                          {m.content}
                        </div>
                        
                        {/* Show More / Show Less and Edit triggers */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-1)' }}>
                          <button
                            onClick={() => setExpandedCards(prev => ({ ...prev, [m.id]: !isExpanded }))}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-primary)',
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            {isExpanded ? 'show less ▲' : 'show more ▼'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingNode(m.id)
                              setEditVal(m.content)
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-faint)',
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            ✎ improve
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {/* Node Detail Drawer */}
      {viewMode === 'graph' && selectedNode && (
        <div style={{
          position: 'fixed',
          top: '0',
          right: 0,
          width: '350px',
          height: '100vh',
          background: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          padding: 'var(--space-5)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 99,
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Node Inspector</span>
            <button
              onClick={() => {
                setSelectedNode(null)
                setConnectedEdges([])
              }}
              style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-muted)', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Node ID</div>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text)', wordBreak: 'break-all', background: 'var(--color-surface-offset)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginTop: '2px' }}>
                {selectedNode.id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Type</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedNode.color || 'var(--color-primary)' }} />
                <span className="mono" style={{ fontSize: 'var(--text-xs)', textTransform: 'capitalize' }}>{selectedNode.type}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Label / Content</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', marginTop: '2px', lineHeight: 1.4, background: 'var(--color-surface-offset)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap' }}>
                {selectedNode.label}
              </div>
            </div>

            {selectedNode.data && Object.keys(selectedNode.data).length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase', marginBottom: '4px' }}>Metadata</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(selectedNode.data).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--color-border)', paddingBottom: '2px' }}>
                      <span style={{ color: 'var(--color-text-faint)' }}>{k}</span>
                      <span style={{ color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase', marginBottom: '4px' }}>Connected Relations ({connectedEdges.length})</div>
              {connectedEdges.length === 0 ? (
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>No active connections.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {connectedEdges.map((e, idx) => {
                    const isSource = e.source === selectedNode.id
                    const partnerId = isSource ? e.target : e.source
                    const partnerName = partnerId.split(':').slice(1).join(':') || partnerId
                    return (
                      <div key={idx} style={{ padding: 'var(--space-2)', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: 'var(--color-primary)' }}>{e.label || 'connects'}</span>
                          <span style={{ color: 'var(--color-text-faint)' }}>{isSource ? 'Outbound ➔' : 'Inbound ↵'}</span>
                        </div>
                        <div style={{ color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={partnerId}>
                          {partnerName}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Icon Components for Graph & Grid View ---- */

function NetworkIcon({ className, size = 12 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M12 8v8" />
      <path d="M12 12H5" />
      <path d="M12 12h7" />
    </svg>
  )
}

function TableIcon({ className, size = 12 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  )
}

