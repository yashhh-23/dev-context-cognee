'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useWebSocket } from '@/lib/ws'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { status } = useWebSocket()

  return (
    <div className="dashboard-shell">
      <Sidebar activePath={pathname} />
      <Topbar wsStatus={status} />
      <main className="main-content">
        <div className="page-wrapper">
          {children}
        </div>
      </main>
    </div>
  )
}
