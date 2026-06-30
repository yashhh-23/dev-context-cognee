'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/auth/signin') {
    return <>{children}</>
  }

  return (
    <div className="dashboard-shell">
      <Sidebar activePath={pathname} />
      <Topbar />
      <main className="main-content">
        <div className="page-wrapper">
          {children}
        </div>
      </main>
    </div>
  )
}
