'use client';
import { useState } from 'react';
import { contributeSearch, GitHubIssue, ContributeOpportunity } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/shared/EmptyState';
import TagPill from '@/components/shared/TagPill';

export default function ContributePanel() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState<string | null>(null);
  const [bugs, setBugs] = useState<GitHubIssue[]>([]);
  const [opps, setOpps] = useState<ContributeOpportunity[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await contributeSearch(undefined, query);
      setKeyword(res.data.keyword);
      setBugs(res.data.similar_bugs);
      setOpps(res.data.opportunities);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally { setLoading(false); }
  }

  const LABEL_COLORS: Record<string, string> = {
    'good first issue': '#3fb950',
    'help wanted':      '#58a6ff',
    'bug':             '#f85149',
  };

  return (
    <div className="panel">
      <Topbar title="Contribute" subtitle="Match your bugs to open GitHub issues and contribution opportunities" />

      <div className="recall-bar">
        <input
          className="recall-input"
          placeholder="e.g. ModuleNotFoundError, gradle duplicate class"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Searching...' : 'Search GitHub'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {keyword === null && !loading && (
        <EmptyState
          icon="➤"
          title="Find matching OSS issues"
          body="Enter an error keyword or paste a stack trace fragment to find open issues and contribution opportunities."
        />
      )}

      {keyword !== null && (
        <>
          <section className="contribute-section">
            <h2 className="section-title">
              Similar open issues
              <span className="section-badge">{bugs.length}</span>
            </h2>
            {bugs.length === 0 ? (
              <p className="muted">No similar issues found.</p>
            ) : (
              <div className="issue-list">
                {bugs.map((b, i) => (
                  <div key={i} className="issue-card">
                    <div className="issue-header">
                      <a href={b.html_url} target="_blank" rel="noopener noreferrer" className="issue-title">
                        {b.title}
                      </a>
                      <span className={`issue-state ${b.state}`}>{b.state}</span>
                    </div>
                    <p className="issue-repo muted">{b.repository}</p>
                    <div className="tag-row">
                      {b.labels.map(l => (
                        <TagPill key={l} label={l} color={LABEL_COLORS[l]} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="contribute-section">
            <h2 className="section-title">
              Contribution opportunities
              <span className="section-badge">{opps.length}</span>
            </h2>
            {opps.length === 0 ? (
              <p className="muted">No good-first-issue matches found.</p>
            ) : (
              <div className="issue-list">
                {opps.map((o, i) => (
                  <div key={i} className="issue-card opportunity">
                    <div className="issue-header">
                      <a href={o.html_url} target="_blank" rel="noopener noreferrer" className="issue-title">
                        {o.title}
                      </a>
                    </div>
                    <p className="issue-repo muted">{o.repository}</p>
                    <div className="tag-row">
                      {o.labels.map(l => (
                        <TagPill key={l} label={l} color={LABEL_COLORS[l]} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
