'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getGraph, GraphNode, GraphEdge } from '@/lib/api';
import { useWebSocket } from '@/lib/ws';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/shared/EmptyState';

type NodeWithPos = GraphNode & { x: number; y: number; vx: number; vy: number };

const TYPE_COLORS: Record<string, string> = {
  project:      '#58a6ff',
  bug:          '#f85149',
  dependency:   '#d29922',
  fix:          '#3fb950',
  github_issue: '#bc8cff',
};

function forceLayout(nodes: NodeWithPos[], edges: GraphEdge[], iterations = 80) {
  const k = Math.sqrt((800 * 600) / Math.max(nodes.length, 1)) * 0.9;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].vx = 0; nodes[i].vy = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (k * k) / dist;
        nodes[i].vx += (dx / dist) * force;
        nodes[i].vy += (dy / dist) * force;
      }
    }
    const idxMap: Record<string, number> = {};
    nodes.forEach((n, i) => { idxMap[n.id] = i; });
    for (const e of edges) {
      const si = idxMap[e.source]; const ti = idxMap[e.target];
      if (si === undefined || ti === undefined) continue;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist * dist) / k;
      nodes[si].vx += (dx / dist) * force * 0.5;
      nodes[si].vy += (dy / dist) * force * 0.5;
      nodes[ti].vx -= (dx / dist) * force * 0.5;
      nodes[ti].vy -= (dy / dist) * force * 0.5;
    }
    const temp = Math.max(10, 50 - iter);
    for (const n of nodes) {
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > 0) {
        n.x += (n.vx / speed) * Math.min(speed, temp);
        n.y += (n.vy / speed) * Math.min(speed, temp);
      }
      n.x = Math.max(30, Math.min(770, n.x));
      n.y = Math.max(30, Math.min(570, n.y));
    }
  }
  return nodes;
}

export default function MemoryGraphPanel() {
  const [nodes, setNodes] = useState<NodeWithPos[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [tooltip, setTooltip] = useState<{ node: NodeWithPos; x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await getGraph();
      const raw = res.data.nodes.map((n, i) => ({
        ...n,
        x: 100 + (i % 8) * 90 + Math.random() * 30,
        y: 100 + Math.floor(i / 8) * 90 + Math.random() * 30,
        vx: 0, vy: 0,
      })) as NodeWithPos[];
      const settled = forceLayout(raw, res.data.edges);
      setNodes(settled);
      setEdges(res.data.edges);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'bug_ingested' || msg.type === 'session_resolved' || msg.type === 'session_forgotten') {
        load();
      }
    });
    return unsub;
  }, [subscribe, load]);

  useEffect(() => { load(); }, [load]);

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const LEGEND = Object.entries(TYPE_COLORS).map(([type, color]) => ({ type, color }));

  return (
    <div className="panel">
      <Topbar title="Memory Graph" subtitle="Cognee hybrid store — nodes and relationships" />

      <div className="graph-legend">
        {LEGEND.map(l => (
          <div key={l.type} className="legend-item">
            <span className="legend-dot" style={{ background: l.color }} />
            <span>{l.type}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="graph-skeleton" />
      ) : nodes.length === 0 ? (
        <EmptyState icon="△" title="No graph data" body="Ingest sessions to build the memory graph." />
      ) : (
        <div className="graph-container">
          <svg
            ref={svgRef}
            viewBox="0 0 800 600"
            className="graph-svg"
            onClick={() => setTooltip(null)}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#444" />
              </marker>
            </defs>

            {edges.map((e, i) => {
              const s = nodeMap[e.source]; const t = nodeMap[e.target];
              if (!s || !t) return null;
              return (
                <g key={i}>
                  <line
                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke="#333" strokeWidth="1.2"
                    markerEnd="url(#arrow)"
                  />
                  <text
                    x={(s.x + t.x) / 2}
                    y={(s.y + t.y) / 2 - 4}
                    className="edge-label"
                    textAnchor="middle"
                  >
                    {e.label}
                  </text>
                </g>
              );
            })}

            {nodes.map(n => (
              <g key={n.id}
                onClick={(ev) => { ev.stopPropagation(); setTooltip({ node: n, x: ev.clientX, y: ev.clientY }); }}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={n.x} cy={n.y} r={14} fill={n.color} opacity={0.85} />
                <text x={n.x} y={n.y + 26} textAnchor="middle" className="node-label">
                  {n.label.slice(0, 14)}
                </text>
              </g>
            ))}
          </svg>

          {tooltip && (
            <div
              className="graph-tooltip"
              style={{ top: tooltip.y - 60, left: tooltip.x + 12 }}
            >
              <p className="tooltip-type">{tooltip.node.type}</p>
              <p className="tooltip-label">{tooltip.node.label}</p>
              {Object.entries(tooltip.node.data).map(([k, v]) => (
                v ? <p key={k} className="tooltip-meta">{k}: {String(v)}</p> : null
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
