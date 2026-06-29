'use client';
import { useState, useEffect } from 'react';

interface ContextData { summary?: string; project?: string; language?: string }

export default function ContextSummary() {
  const [data, setData] = useState<ContextData | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/context/current')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data?.summary) return null;

  return (
    <div className="context-panel animate-in">
      <div className="context-label">
        Active Context · {data.project ?? 'workspace'}{data.language ? ` · ${data.language}` : ''}
      </div>
      <div className="context-text">{data.summary}</div>
    </div>
  );
}
