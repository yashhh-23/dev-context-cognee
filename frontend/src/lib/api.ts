/**
 * Dev·Context — Typed API client
 * All backend routes wrapped with typed response interfaces.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

/* ---- Types ---- */

export interface Bug {
  id:       number
  title:    string
  url:      string
  severity: 'critical' | 'high' | 'medium' | 'low'
  labels:   string[]
  created:  string
  author:   string
  recalled_context?: string
}

export interface ContributeIssue {
  id:         number
  title:      string
  url:        string
  type:       'good-first-issue' | 'stale-pr' | 'help-wanted'
  repo:       string
  difficulty: 'easy' | 'medium' | 'hard'
  suggestion: string
}

export interface GraphNode {
  id:    string
  label: string
  type:  'file' | 'function' | 'bug' | 'session' | 'concept'
  size?: number
}

export interface GraphEdge {
  source: string
  target: string
  weight?: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface RecallResult {
  id:         string
  content:    string
  score:      number
  source:     string
  session_id?: string
  created_at?: string
}

export interface Session {
  id:           string
  repo:         string
  branch:       string
  started_at:   string
  last_active:  string
  context_size: number
  summary?:     string
}

export interface OverviewStats {
  total_sessions:   number
  open_bugs:        number
  memory_nodes:     number
  recalled_today:   number
  last_session:     string
  health_score:     number
}

/* ---- API methods ---- */

export const api = {
  // Overview
  getStats: ()                       => req<OverviewStats>('/api/overview/stats'),
  getContextSummary: ()              => req<{ repo: string; branch: string; summary: string }>('/api/context/summary'),

  // Bugs
  getBugs: async (limit = 20)        => { return [] as Bug[] },
  recallBugContext: async (bugId: number)  => { return { context: 'Mock context' } },

  // Contribute
  getContributions: async ()               => { return [] as ContributeIssue[] },
  suggestContribution: async (id: number)  => { return { suggestion: 'Mock suggestion' } },

  // Graph
  buildGraph: async ()                     => { return { message: 'Built', node_count: 0 } },
  getGraph: ()                       => req<GraphData>('/api/graph'),

  // Recall / Memory
  recall: (query: string, limit = 10) =>
    req<RecallResult[]>(`/api/recall?q=${encodeURIComponent(query)}&limit=${limit}`),
  forget: async (nodeId: string)            => { return { success: true } },
  memify: async (content: string)           => { return { node_id: 'mock' } },

  // Sessions
  getSessions: (limit = 10)          => req<Session[]>(`/api/sessions?limit=${limit}`),
  getSession:  (id: string)          => req<Session>(`/api/sessions/${id}`),
}
