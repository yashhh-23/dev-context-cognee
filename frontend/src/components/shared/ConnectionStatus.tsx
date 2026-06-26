'use client'

import { useWebSocket } from '@/hooks/useWebSocket'
import { useEffect, useState } from 'react'

export default function ConnectionStatus() {
  const { status, reconnectAttempts } = useWebSocket()
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (status === 'disconnected' || status === 'reconnecting') {
      const delay = Math.min(2 ** reconnectAttempts * 1000, 30000)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state update in effect
      setCountdown(Math.ceil(delay / 1000))
      
      const interval = setInterval(() => {
        setCountdown(prev => (prev > 1 ? prev - 1 : 0))
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [status, reconnectAttempts])

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          dotColor: '#2dd4bf',
          textColor: 'var(--color-text-muted)',
          text: 'Live',
          animate: 'pulse',
        }
      case 'reconnecting':
        return {
          dotColor: '#eab308',
          textColor: '#eab308',
          text: `Reconnecting in ${countdown}s...`,
          animate: 'spin',
        }
      case 'connecting':
        return {
          dotColor: '#a3a3a3',
          textColor: 'var(--color-text-faint)',
          text: 'Connecting...',
          animate: 'pulse',
        }
      case 'disconnected':
      default:
        return {
          dotColor: '#f87171',
          textColor: '#f87171',
          text: `Offline — retrying in ${countdown}s`,
          animate: 'pulse',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-surface-offset)',
        border: '1px solid var(--color-border)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: config.textColor,
        userSelect: 'none',
      }}
      aria-label={`WebSocket status: ${config.text}`}
    >
      <span style={{ position: 'relative', display: 'flex', height: '8px', width: '8px' }}>
        {config.animate === 'pulse' && (
          <span
            style={{
              position: 'absolute',
              display: 'inline-flex',
              height: '100%',
              width: '100%',
              borderRadius: '50%',
              background: config.dotColor,
              opacity: 0.75,
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            borderRadius: '50%',
            height: '8px',
            width: '8px',
            background: config.dotColor,
            animation: config.animate === 'spin' ? 'spin 1s linear infinite' : undefined,
          }}
        />
      </span>
      <span>{config.text}</span>

      {/* Embedded inline animations */}
      <style jsx global>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
