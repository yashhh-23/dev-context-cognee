import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

// ── types ────────────────────────────────────────────────────────────
export interface Session {
  id: string;
  project: string;
  branch?: string;
  tags?: string[];
  timestamp: string;
  status: string;
  error_message?: string;
}

export interface StatsResponse {
  total_sessions: number;
  completed: number;
  failed: number;
  projects: string[];
  bug_frequency: { day: string; count: number }[];
}

export interface RecallResult {
  text?: string;
  [key: string]: unknown;
}

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  color: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface GitHubIssue {
  title: string;
  html_url: string;
  repository: string;
  state: string;
  labels: string[];
}

export interface ContributeOpportunity {
  title: string;
  html_url: string;
  repository: string;
  labels: string[];
  stars: number;
}

// ── calls ────────────────────────────────────────────────────────────
export const getStats        = ()                        => api.get<StatsResponse>('/stats/');
export const getSessions     = (skip = 0, limit = 50)   => api.get<Session[]>(`/sessions/?skip=${skip}&limit=${limit}`);
export const recallMemory    = (q: string, limit = 5)   => api.get<{ results: RecallResult[]; total: number; query: string }>(`/recall/?q=${encodeURIComponent(q)}&limit=${limit}`);
export const getGraph        = (project?: string)       => api.get<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/graph/${project ? `?project=${encodeURIComponent(project)}` : ''}`);
export const contributeSearch = (sessionId?: string, q?: string) => {
  const params = new URLSearchParams();
  if (sessionId) params.set('session_id', sessionId);
  if (q) params.set('q', q);
  return api.get<{ keyword: string; similar_bugs: GitHubIssue[]; opportunities: ContributeOpportunity[] }>(`/contribute/search?${params}`);
};
export const improveSession  = (id: string, fixText?: string) => api.post(`/improve/${id}`, { fix_text: fixText ?? '' });
export const forgetSession   = (id: string)                   => api.delete(`/forget/${id}`);
export const ingestLog       = (payload: { project: string; branch?: string; terminal_output: string; tags?: string[] }) => api.post('/ingest/', payload);
