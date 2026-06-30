import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ConnectionStatus from '@/components/shared/ConnectionStatus'
import BackendStatusBanner from '@/components/shared/BackendStatusBanner'

// Mock the hooks
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn()
}))

jest.mock('@/hooks/useHealth', () => ({
  useHealth: jest.fn()
}))

import { useWebSocket } from '@/hooks/useWebSocket'
import { useHealth } from '@/hooks/useHealth'

describe('ConnectionStatus Component', () => {
  it('renders Live status when connected', () => {
    (useWebSocket as jest.Mock).mockReturnValue({
      status: 'connected',
      reconnectAttempts: 0
    })
    render(<ConnectionStatus />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders Reconnecting status when reconnecting', () => {
    (useWebSocket as jest.Mock).mockReturnValue({
      status: 'reconnecting',
      reconnectAttempts: 2
    })
    render(<ConnectionStatus />)
    expect(screen.getByText(/Reconnecting/)).toBeInTheDocument()
  })

  it('renders Offline status when disconnected', () => {
    (useWebSocket as jest.Mock).mockReturnValue({
      status: 'disconnected',
      reconnectAttempts: 3
    })
    render(<ConnectionStatus />)
    expect(screen.getByText(/Offline/)).toBeInTheDocument()
  })
})

describe('BackendStatusBanner Component', () => {
  it('renders nothing when backend is healthy', () => {
    (useHealth as jest.Mock).mockReturnValue({
      isHealthy: true,
      loading: false,
      checkImmediate: jest.fn()
    })
    const { container } = render(<BackendStatusBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders startup banner when backend is unhealthy', () => {
    const mockCheckImmediate = jest.fn();
    (useHealth as jest.Mock).mockReturnValue({
      isHealthy: false,
      loading: false,
      checkImmediate: mockCheckImmediate
    })
    render(<BackendStatusBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Backend is starting up/)).toBeInTheDocument()
    
    const retryBtn = screen.getByRole('button', { name: /retry now/i })
    fireEvent.click(retryBtn)
    expect(mockCheckImmediate).toHaveBeenCalledTimes(1)
  })
})
