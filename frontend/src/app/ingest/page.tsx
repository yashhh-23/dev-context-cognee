import type { Metadata } from 'next'
import IngestClient from './IngestClient'

export const metadata: Metadata = {
  title: 'Ingest Repository | Dev-Context Cognee',
  description: 'Index git repositories, parse AST dependencies, and store codebase context in Cognee vector memory',
}

export default function IngestPage() {
  return <IngestClient />
}
