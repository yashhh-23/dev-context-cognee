'use client';

import { useState } from 'react';
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

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  return (
    <div id="app-shell">
      <Sidebar activeTab={tab} onTabChange={setTab} />
      <div className="main-area">
        <TopBar />
        <div className="page-scroll">
          {tab === 'overview'   && <OverviewTab   addToast={addToast} onTabChange={setTab} />}
          {tab === 'bugs'       && <BugsTab       addToast={addToast} />}
          {tab === 'contribute' && <ContributeTab />}
          {tab === 'recall'     && <RecallTab     />}
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
