'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWebSocket } from '@/lib/ws';

export interface StatsResponse {
  total_sessions: number;
  completed: number;
  failed: number;
  projects: string[];
  bug_frequency: { day: string; count: number }[];
}
import StatCard from '@/components/shared/StatCard';
import Topbar from '@/components/layout/Topbar';

export default function OverviewPanel() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await (api as any).getStats();
      setStats(res.data || res);
    } catch (e) {
      console.error('stats error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'bug_ingested') load();
  }, [lastMessage, load]);

  useEffect(() => { load(); }, [load]);

  const maxCount = stats ? Math.max(...stats.bug_frequency.map((d: any) => d.count), 1) : 1;

  return (
    <div className="panel">
      <Topbar title="Overview" subtitle="Session and memory summary" />
      {loading ? (
        <div className="skeleton-grid">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
      ) : stats ? (
        <>
          <div className="stat-grid">
            <StatCard label="Total Sessions" value={stats.total_sessions} />
            <StatCard label="Completed" value={stats.completed} color="#3fb950" />
            <StatCard label="Failed / Errors" value={stats.failed} color="#f85149" />
            <StatCard label="Projects" value={stats.projects.length} />
          </div>

          <section className="chart-section">
            <h2 className="section-title">Bug Frequency — Last 7 Days</h2>
            <div className="bar-chart">
              {stats.bug_frequency.map((d: any) => (
                <div key={d.day} className="bar-col">
                  <div
                    className="bar"
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                    title={`${d.count} sessions`}
                  />
                  <span className="bar-label">{d.day}</span>
                </div>
              ))}
            </div>
          </section>

          {stats.projects.length > 0 && (
            <section className="projects-section">
              <h2 className="section-title">Active Projects</h2>
              <div className="project-list">
                {stats.projects.map((p: any) => (
                  <div key={p} className="project-chip">{p}</div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="muted">No data available. Ingest a session to get started.</p>
      )}
    </div>
  );
}
