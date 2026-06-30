import type { Metadata } from 'next'
import './globals.css'
import DashboardShell from '@/components/layout/DashboardShell'
import { WebSocketProvider } from '@/context/WebSocketContext'
import BackendStatusBanner from '@/components/shared/BackendStatusBanner'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Dev·Context — Cognee Memory Dashboard',
  description: 'AI-powered developer context engine built on Cognee memory',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <WebSocketProvider>
          <BackendStatusBanner />
          <DashboardShell>{children}</DashboardShell>
          <Toaster theme="dark" closeButton position="top-right" />
        </WebSocketProvider>
      </body>
    </html>
  )
}
