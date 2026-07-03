import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import IngestClient from '../app/ingest/IngestClient'
import OverviewClient from '../app/overview/OverviewClient'

// Mock the WS hook
jest.mock('@/lib/ws', () => ({
  useWebSocket: () => ({
    status: 'connected',
    lastMessage: null,
    send: jest.fn()
  })
}))

// Mock the API client
jest.mock('@/lib/api', () => ({
  api: {
    getStats: jest.fn().mockResolvedValue({
      total_sessions: 24,
      open_bugs: 8,
      memory_nodes: 142,
      recalled_today: 12,
      last_session: '2026-06-26T17:38:13Z',
      health_score: 85
    }),
    getSessions: jest.fn().mockResolvedValue([
      {
        id: 'sess-01',
        repo: 'yashhh-23/dev-context-cognee',
        branch: 'main',
        started_at: '2026-06-26T15:30:00Z',
        context_size: 42,
        status: 'completed',
        summary: 'Ingested file app/main.py and built initial dependency mapping graph.'
      }
    ]),
    getBugsTrend: jest.fn().mockResolvedValue({
      labels: ['Mon', 'Tue', 'Wed'],
      opened: [1, 2, 3],
      closed: [0, 1, 2]
    }),
    getDependenciesHealth: jest.fn().mockResolvedValue({
      total_dependencies: 34,
      outdated_count: 5,
      vulnerable_count: 2,
      packages: []
    }),
    autoCleanMemories: jest.fn().mockResolvedValue({
      status: 'success',
      cleaned_count: 3
    }),
    ingestGithub: jest.fn().mockResolvedValue({
      message: 'success',
      files_processed: 42,
      nodes_created: 142,
      time_taken: '9.8s'
    })
  }
}))

// Mock dynamic import for BugTrendChart to render a simple div
jest.mock('next/dynamic', () => () => {
  return function DummyChart() {
    return <div data-testid="bug-trend-chart">Mock Chart</div>
  }
})

describe('Dashboard and Ingest Ingestion Integration Flow', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders dashboard with stats and recent sessions', async () => {
    await act(async () => {
      render(<OverviewClient />)
    })

    // Assert stats card values render
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('142')).toBeInTheDocument()

    // Assert recent session renders
    expect(screen.getByText('dev-context-cognee')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('Ingested file app/main.py and built initial dependency mapping graph.')).toBeInTheDocument()
  })

  it('simulates git repository ingestion flow successfully', async () => {
    render(<IngestClient />)

    // Form inputs and button exist
    const repoInput = screen.getByLabelText(/Git Repository URL/i)
    const branchInput = screen.getByLabelText(/Branch /i)
    const triggerBtn = screen.getByRole('button', { name: /trigger ingestion/i })

    expect(repoInput).toHaveValue('github.com/yashhh-23/dev-context-cognee')
    expect(branchInput).toHaveValue('feat/frontend-prd')

    // Click trigger ingestion
    fireEvent.click(triggerBtn)

    // Assert console transitions to running
    expect(screen.getByText(/indexing codebase.../i)).toBeInTheDocument()

    // Fast-forward through mock steps
    await act(async () => {
      jest.advanceTimersByTime(10000)
    })

    // Ingestion should be completed, displaying summary cards
    expect(screen.getByText(/Ingestion Completed Successfully/i)).toBeInTheDocument()
    expect(screen.getByText('42 files')).toBeInTheDocument()
    expect(screen.getByText('142 nodes')).toBeInTheDocument()
  })
})
