/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from 'sonner'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

if (!process.env.NEXT_PUBLIC_API_URL && typeof window !== 'undefined') {
  console.warn('NEXT_PUBLIC_API_URL not set, using localhost fallback')
}

// Global set to throttle toasts so they don't spam the UI
let lastToastTime = 0

function showFallbackToast() {
  if (typeof window !== 'undefined') {
    const now = Date.now()
    if (now - lastToastTime > 5000) {
      toast.info('Using cached demo data')
      lastToastTime = now
    }
  }
}

async function getMockFallback(path: string): Promise<any> {
  const cleanPath = path.split('?')[0]

  if (cleanPath.startsWith('/health')) {
    return (await import('./mocks/health.json')).default
  }
  if (cleanPath.startsWith('/api/overview/stats')) {
    return (await import('./mocks/stats.json')).default
  }
  if (cleanPath.startsWith('/api/overview/bug-trend')) {
    return (await import('./mocks/bugs_trend.json')).default
  }
  if (cleanPath.startsWith('/api/dependencies/health')) {
    return (await import('./mocks/dependencies_health.json')).default
  }
  if (cleanPath.startsWith('/api/stats/memory-health')) {
    return (await import('./mocks/memory_stats.json')).default
  }
  // Session routes — specific before general
  if (cleanPath.match(/^\/api\/sessions\/[^/]+$/)) {
    const sessions = (await import('./mocks/sessions.json')).default as any[]
    const id = cleanPath.split('/').pop()
    return sessions.find((s: any) => s.id === id) || sessions[0]
  }
  if (cleanPath.startsWith('/api/sessions')) {
    return (await import('./mocks/sessions.json')).default
  }
  // Recall / memory routes — specific routes BEFORE the broad /api/recall prefix
  if (cleanPath.startsWith('/api/recall/memify')) {
    return { node_id: 'mock-node-' + Math.random().toString(36).substring(2, 11) }
  }
  if (cleanPath.includes('/pin')) {
    const parts = cleanPath.split('/')
    const nodeId = parts[parts.length - 2]
    return { success: true, node_id: nodeId, pinned: true }
  }
  if (cleanPath.includes('/unpin')) {
    const parts = cleanPath.split('/')
    const nodeId = parts[parts.length - 2]
    return { success: true, node_id: nodeId, pinned: false }
  }
  // Generic recall search — must come after all specific /api/recall/* routes
  if (cleanPath.startsWith('/recall') || cleanPath.startsWith('/api/recall') || cleanPath.startsWith('/api/memory')) {
    return (await import('./mocks/memory_search.json')).default
  }
  if (cleanPath.startsWith('/api/graph/build')) {
    return { message: 'Graph built successfully (cached demo data)', node_count: 142 }
  }
  if (cleanPath.startsWith('/graph')) {
    return (await import('./mocks/memory_graph.json')).default
  }
  if (cleanPath.startsWith('/api/bugs/trend')) {
    return (await import('./mocks/bugs_trend.json')).default
  }
  if (cleanPath.startsWith('/api/bugs')) {
    const mockBugs = [
      { id: 1, title: "Uncaught TypeError: Cannot read properties of undefined (reading 'status') in WebSocketContext", url: "https://github.com/yashhh-23/dev-context-cognee/issues/101", severity: "critical", labels: ["bug", "websocket"], created: "2026-06-26T12:00:00Z", author: "yashhh" },
      { id: 2, title: "Render free tier cold start timeout (>5s) on /api/health", url: "https://github.com/yashhh-23/dev-context-cognee/issues/102", severity: "high", labels: ["bug", "api"], created: "2026-06-26T13:30:00Z", author: "dev-context-bot" },
      { id: 3, title: "Memory graph nodes overlapping when vis.js physics is enabled", url: "https://github.com/yashhh-23/dev-context-cognee/issues/103", severity: "medium", labels: ["bug", "graph"], created: "2026-06-26T14:15:00Z", author: "yashhh" },
      { id: 4, title: "Missing is_pinned property in Cognee recall response", url: "https://github.com/yashhh-23/dev-context-cognee/issues/104", severity: "medium", labels: ["bug", "database"], created: "2026-06-26T15:00:00Z", author: "cognee-maintainer" }
    ]
    return {
      bugs: mockBugs,
      total: 4,
      counts: { critical: 1, high: 1, medium: 2, low: 0 }
    }
  }
  if (cleanPath.startsWith('/api/contribute')) {
    return [
      { id: 1, title: "Implement dark mode scrollbar styles for chrome and firefox", url: "https://github.com/yashhh-23/dev-context-cognee/issues/201", type: "good-first-issue", repo: "dev-context-cognee", difficulty: "easy", suggestion: "Add global CSS rules using ::-webkit-scrollbar in globals.css." },
      { id: 2, title: "Deduplicate memories using is_duplicate() in cognee_utils.py", url: "https://github.com/yashhh-23/dev-context-cognee/issues/202", type: "help-wanted", repo: "dev-context-cognee", difficulty: "medium", suggestion: "Write a background clean task that compares session terminal outputs." }
    ]
  }
  if (cleanPath.startsWith('/api/memories/auto-clean')) {
    return { status: 'success', cleaned_count: 3 }
  }
  if (cleanPath.startsWith('/api/improve')) {
    const parts = cleanPath.split('/')
    const id = parts[parts.length - 1]
    return { status: 'success', session_id: id }
  }
  if (cleanPath.startsWith('/api/forget')) {
    const parts = cleanPath.split('/')
    const id = parts[parts.length - 1]
    return { status: 'success', session_id: id }
  }
  return { success: true }
}

async function req<T>(path: string, opts?: RequestInit, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const key = sessionStorage.getItem('byok_key')
    if (key) {
      headers['X-BYOK-Key'] = key
    }
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { ...headers, ...(opts?.headers as Record<string, string>) },
      signal: controller.signal,
      ...opts,
    })

    clearTimeout(timeoutId)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`API ${res.status}: ${body}`)
    }

    return await res.json() as T
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError' || String(err.message || err).includes('aborted')) {
      throw err
    }
    console.debug(`[API Fallback] Request to ${path} failed, using mock data. Error:`, err.message || err)
    showFallbackToast()
    return await getMockFallback(path) as T
  }
}

/* ---- Types ---- */
export interface Bug {
  id: number
  title: string
  url: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  labels: string[]
  created: string
  author: string
  recalled_context?: string
}

export interface BugsResponse {
  bugs: Bug[]
  total: number
  counts: Record<string, number>
}

export interface ContributeIssue {
  id: number
  title: string
  url: string
  type: 'good-first-issue' | 'stale-pr' | 'help-wanted'
  repo: string
  difficulty: 'easy' | 'medium' | 'hard'
  suggestion: string
}
export interface GraphNode {
  id: string
  label: string
  type: 'project' | 'bug' | 'dependency' | 'fix' | 'github_issue'
  color?: string
  size?: number
  data?: Record<string, any>
}
export interface GraphEdge {
  source: string
  target: string
  label?: string
  weight?: number
}
export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
export interface RecallResult {
  id: string
  content: string
  score: number
  source: string
  session_id?: string
  created_at?: string
  conflicts?: string[]
  pinned?: boolean
  thumbs?: string
  confidence_score?: number
  text?: string
}
export interface Session {
  id: string
  repo: string
  branch: string
  started_at: string
  context_size: number
  summary?: string
  status?: string
  project?: string
  timestamp?: string
  tags?: string[]
  error_message?: string
  terminal_output?: string
}
export interface OverviewStats {
  total_sessions: number
  open_bugs: number
  memory_nodes: number
  recalled_today: number
  last_session: string
  health_score: number
  code_quality?: number
  test_coverage?: number
  documentation?: number
}

function normalizeRecallResults(payload: unknown): RecallResult[] {
  const rawItems =
    Array.isArray(payload) ? payload
    : Array.isArray((payload as { bugs?: unknown[] })?.bugs) ? (payload as { bugs: unknown[] }).bugs
    : Array.isArray((payload as { results?: unknown[] })?.results) ? (payload as { results: unknown[] }).results
    : Array.isArray((payload as { items?: unknown[] })?.items) ? (payload as { items: unknown[] }).items
    : []

  return rawItems.map((item, index) => {
    const entry = (item ?? {}) as Partial<RecallResult> & Record<string, unknown>
    return {
      id: String(entry.id ?? entry.node_id ?? index),
      content: typeof entry.content === 'string'
        ? entry.content
        : typeof entry.text === 'string'
          ? entry.text
          : '',
      score: typeof entry.score === 'number'
        ? entry.score
        : typeof entry.relevance === 'number'
          ? entry.relevance
          : 0,
      source: typeof entry.source === 'string' ? entry.source : 'unknown',
      session_id: typeof entry.session_id === 'string' ? entry.session_id : undefined,
      created_at: typeof entry.created_at === 'string' ? entry.created_at : undefined,
      conflicts: Array.isArray(entry.conflicts) ? entry.conflicts.filter((v): v is string => typeof v === 'string') : [],
      pinned: typeof entry.pinned === 'boolean' ? entry.pinned : false,
      thumbs: typeof entry.thumbs === 'string' ? entry.thumbs : undefined,
      confidence_score: typeof entry.confidence_score === 'number' ? entry.confidence_score : undefined,
      text: typeof entry.content === 'string' ? entry.content : typeof entry.text === 'string' ? entry.text : '',
    }
  })
}

function normalizeGraphData(payload: unknown): GraphData {
  const graphPayload = (payload ?? {}) as {
    nodes?: unknown[]
    edges?: unknown[]
    data?: {
      nodes?: unknown[]
      edges?: unknown[]
    }
  }

  const rawNodes = Array.isArray(graphPayload.nodes)
    ? graphPayload.nodes
    : Array.isArray(graphPayload.data?.nodes)
      ? graphPayload.data.nodes
      : []

  const rawEdges = Array.isArray(graphPayload.edges)
    ? graphPayload.edges
    : Array.isArray(graphPayload.data?.edges)
      ? graphPayload.data.edges
      : []

  return {
    nodes: rawNodes.map((node, index) => {
      const entry = (node ?? {}) as Partial<GraphNode> & Record<string, unknown>
      const rawType = typeof entry.type === 'string' ? entry.type : 'project'
      const type: GraphNode['type'] =
        rawType === 'bug' || rawType === 'dependency' || rawType === 'fix' || rawType === 'github_issue'
          ? rawType
          : 'project'

      return {
        id: String(entry.id ?? index),
        label: typeof entry.label === 'string' ? entry.label : String(entry.name ?? entry.id ?? `node-${index}`),
        type,
        color: typeof entry.color === 'string' ? entry.color : undefined,
        size: typeof entry.size === 'number' ? entry.size : undefined,
      }
    }),
    edges: rawEdges.map((edge) => {
      const entry = (edge ?? {}) as Partial<GraphEdge> & Record<string, unknown>
      return {
        source: String(entry.source ?? entry.from ?? ''),
        target: String(entry.target ?? entry.to ?? ''),
        label: typeof entry.label === 'string' ? entry.label : undefined,
        weight: typeof entry.weight === 'number' ? entry.weight : undefined,
      }
    }).filter(edge => edge.source && edge.target),
  }
}

/* ---- API methods ---- */
export const api = {
  // Overview
  getHealth: () => req<{ status: string; version: string }>('/health'),
  getStats: () => req<OverviewStats>('/api/overview/stats'),
  getContextSummary: () => req<{ repo: string; branch: string; summary: string }>('/api/context/summary'),
  getMemoryStats: () => req<{ total_memories: number; graph_nodes: number; graph_edges: number; last_updated: string }>('/api/stats/memory-health'),
  getDependenciesHealth: () => req<{ total_dependencies: number; outdated_count: number; vulnerable_count: number; packages: any[] }>('/api/dependencies/health'),
  getBugsTrend: () => req<{ labels: string[]; opened: number[]; closed: number[] }>('/api/overview/bug-trend'),
  // Bugs
  getBugs: (limit = 100, page = 1) => req<BugsResponse>(`/api/bugs?limit=${limit}&page=${page}`),
  recallBugContext: (bugId: number) => req<{ context: string }>(`/api/bugs/${bugId}/recall`),
  // Contribute
  getContributions: () => req<ContributeIssue[]>('/api/contribute'),
  suggestContribution: (id: number) => req<{ suggestion: string }>(`/api/contribute/${id}/suggest`),
  // Graph
  buildGraph: () => req<{ message: string; node_count: number }>('/api/graph/build', { method: 'POST' }),
  getGraph: async () => normalizeGraphData(await req<unknown>('/api/graph')),
  // Recall / Memory
  recall: async (query: string, limit = 10) =>
    normalizeRecallResults(await req<unknown>('/api/recall', { method: 'POST', body: JSON.stringify({ query, limit }) })),
  searchMemory: async (query: string, limit = 10) =>
    normalizeRecallResults(await req<unknown>('/api/recall', { method: 'POST', body: JSON.stringify({ query, limit }) })),
  forget: (nodeId: string) => req<{ success: boolean }>(`/api/recall/${nodeId}`, { method: 'DELETE' }),
  memify: (content: string) =>
    req<{ node_id: string }>('/api/recall/memify', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  pin: (nodeId: string) =>
    req<{ success: boolean; node_id: string; pinned: boolean }>(`/api/recall/${nodeId}/pin`, { method: 'POST' }),
  unpin: (nodeId: string) =>
    req<{ success: boolean; node_id: string; pinned: boolean }>(`/api/recall/${nodeId}/unpin`, { method: 'POST' }),
  autoCleanMemories: () =>
    req<{ status: string; cleaned_count: number; message: string }>('/api/memories/auto-clean', { method: 'POST' }),
  submitFeedback: (nodeId: string, thumbs: 'up' | 'down', correctionNote?: string) =>
    req<{ success: boolean; confidence_score: number }>('/api/recall/' + nodeId + '/feedback', {
      method: 'POST',
      body: JSON.stringify({ thumbs, correction_note: correctionNote }),
    }),
  chatMemory: (message: string) =>
    req<{ content: string; sources: RecallResult[] }>('/api/recall/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }, 90000), // 90s — hybrid graph+vector+LLM pipeline needs extra headroom
  // Sessions
  getSessions: (limit = 10) => req<Session[]>(`/api/sessions?limit=${limit}`),
  getSession: (id: string) => req<Session>(`/api/sessions/${id}`),
  improveSession: (id: string, fixText?: string) =>
    req<{ status: string; session_id: string }>(`/api/improve/${id}`, {
      method: 'POST',
      body: JSON.stringify({ fix_text: fixText }),
    }),
  forgetSession: (id: string) =>
    req<{ status: string; session_id: string }>(`/api/forget/${id}`, {
      method: 'DELETE',
    }),
}

export interface GitHubIssue {
  html_url: string
  title: string
  state?: string
  repository?: string
  labels: string[]
}
export interface ContributeOpportunity {
  html_url: string
  title: string
  repository?: string
  labels: string[]
}
export async function contributeSearch(bugId?: string, query?: string): Promise<{ data: { keyword: string; similar_bugs: GitHubIssue[]; opportunities: ContributeOpportunity[] } }> {
  const issues = await api.getContributions().catch(() => [])
  const mappedBugs: GitHubIssue[] = issues.map(i => ({
    html_url: i.url,
    title: i.title,
    state: 'open',
    repository: i.repo,
    labels: [i.type || 'bug']
  }))
  return {
    data: {
      keyword: query || 'bug',
      similar_bugs: mappedBugs,
      opportunities: mappedBugs
    }
  }
}
export async function getGraph(): Promise<{ data: GraphData }> {
  const g = await api.getGraph()
  return { data: g }
}
export async function recallMemory(query: string): Promise<{ data: { results: RecallResult[] } }> {
  const res = await api.recall(query)
  return { data: { results: res } }
}
