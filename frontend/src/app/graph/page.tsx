import type { Metadata } from 'next'
import GraphClient from './GraphClient'

export const metadata: Metadata = {
  title: 'Memory Graph & Manager | Dev-Context Cognee',
  description: 'Explore the interactive Cognee memory node network, search memory cards, and pin or improve knowledge graph nodes',
}

export default function GraphPage() {
  return <GraphClient />
}
