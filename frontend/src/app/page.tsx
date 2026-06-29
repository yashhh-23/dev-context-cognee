'use client';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import OverviewTab from './components/OverviewTab';
import BugsTab from './components/BugsTab';
import ContributeTab from './components/ContributeTab';
import RecallTab from './components/RecallTab';
import ToastContainer from './components/ToastContainer';

export type Tab = 'overview' | 'bugs' | 'contribute' | 'recall';
export type Toast = { id: number; msg: string; type: 'success' | 'error' };

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bugCount, setBugCount] = useState(0);
  const [contributeCount, setContributeCount] = useState(0);

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    fetch('http://localhost:8000/api/bugs/detect')
      .then(r => r.json())
      .then(d => setBugCount(d.bugs?.length ?? 0))
      .catch(() => {});
    fetch('http://localhost:8000/api/contribute/suggestions')
      .then(r => r.json())
      .then(d => setContributeCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, []);

  return (
    <div id="app-shell">
      <Sidebar
        activeTab={tab}
        onTabChange={setTab}
        bugCount={bugCount}
        contributeCount={contributeCount}
      />
      <div className="main-area">
        <TopBar />
        <div className="page-scroll">
          {tab === 'overview'   && <OverviewTab   addToast={addToast} onTabChange={setTab} />}
          {tab === 'bugs'       && <BugsTab       addToast={addToast} />}
          {tab === 'contribute' && <ContributeTab />}
          {tab === 'recall'     && <RecallTab />}
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
