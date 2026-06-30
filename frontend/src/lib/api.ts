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
  if (cleanPath.startsWith('/api/recall') || cleanPath.startsWith('/api/memory')) {
    return (await import('./mocks/memory_search.json')).default
  }
  if (cleanPath.startsWith('/api/graph/build')) {
    return { message: 'Graph built successfully (cached demo data)', node_count: 142 }
  }
  if (cleanPath.startsWith('/api/graph')) {
    return (await import('./mocks/memory_graph.json')).default
  }
  if (cleanPath.startsWith('/api/bugs/trend')) {
    return (await import('./mocks/bugs_trend.json')).default
  }
  if (cleanPath.startsWith('/api/bugs')) {
    return [
      { id: 1, title: "Uncaught TypeError: Cannot read properties of undefined (reading 'status') in WebSocketContext", url: "https://github.com/yashhh-23/dev-context-cognee/issues/101", severity: "critical", labels: ["bug", "websocket"], created: "2026-06-26T12:00:00Z", author: "yashhh" },
      { id: 2, title: "Render free tier cold start timeout (>5s) on /api/health", url: "https://github.com/yashhh-23/dev-context-cognee/issues/102", severity: "high", labels: ["bug", "api"], created: "2026-06-26T13:30:00Z", author: "dev-context-bot" },
      { id: 3, title: "Memory graph nodes overlapping when vis.js physics is enabled", url: "https://github.com/yashhh-23/dev-context-cognee/issues/103", severity: "medium", labels: ["bug", "graph"], created: "2026-06-26T14:15:00Z", author: "yashhh" },
      { id: 4, title: "Missing is_pinned property in Cognee recall response", url: "https://github.com/yashhh-23/dev-context-cognee/issues/104", severity: "medium", labels: ["bug", "database"], created: "2026-06-26T15:00:00Z", author: "cognee-maintainer" }
    ]
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

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
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
    console.warn(`[API Fallback] Request to ${path} failed, using mock data. Error:`, err.message || err)
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
}
export interface Session {
  id: string
  repo: string
  branch: string
  started_at: string
  last_active: string
  context_size: number
  summary?: string
  status?: string
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
  getBugs: (limit = 20) => req<Bug[]>(`/api/bugs?limit=${limit}`),
  recallBugContext: (bugId: number) => req<{ context: string }>(`/api/bugs/${bugId}/recall`),
  // Contribute
  getContributions: () => req<ContributeIssue[]>('/api/contribute'),
  suggestContribution: (id: number) => req<{ suggestion: string }>(`/api/contribute/${id}/suggest`),
  // Graph
  buildGraph: () => req<{ message: string; node_count: number }>('/api/graph/build', { method: 'POST' }),
  getGraph: () => req<GraphData>('/api/graph'),
  // Recall / Memory
  recall: (query: string, limit = 10) =>
    req<RecallResult[]>(`/api/recall?q=${encodeURIComponent(query)}&limit=${limit}`),
  searchMemory: (query: string, limit = 10) =>
    req<RecallResult[]>(`/api/recall/search?q=${encodeURIComponent(query)}&limit=${limit}`),
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
    }),
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
