import type { Metadata } from 'next'
import OverviewClient from './OverviewClient'

export const metadata: Metadata = {
  title: 'Overview | Dev-Context Cognee',
  description: 'Repository health, memory usage, and recent sessions overview',
}

export default function OverviewPage() {
  return <OverviewClient />
}
