import type { Metadata } from 'next'
import RecallClient from './RecallClient'

export const metadata: Metadata = {
  title: 'Recall & Ask | Dev-Context Cognee',
  description: 'Ask questions, trace memory lifecycles, and search Cognee memory graph',
}

export default function RecallPage() {
  return <RecallClient />
}
