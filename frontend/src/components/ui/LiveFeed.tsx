'use client'

import { useEffect, useState } from 'react'
import { useWebSocket, type WsMessage } from '@/lib/ws'

interface FeedEvent {
  id:      string
  type:    string
  label:   string
  time:    Date
}

const EVENT_COLORS: Record<string, string> = {
  memory_stored:   'var(--color-success)',
  memory_recalled: 'var(--color-primary)',
  bug_opened:      'var(--color-error)',
  bug_closed:      'var(--color-success)',
  session_started: 'var(--color-info)',
  graph_built:     'var(--color-primary)',
}

export default function LiveFeed() {
  const { status, subscribe } = useWebSocket()
  const [events, setEvents]   = useState<FeedEvent[]>([])

  useEffect(() => {
    const unsub = subscribe((msg: WsMessage) => {
      const payload = msg.payload as Record<string, string> | null
      const label   = payload?.label ?? payload?.message ?? msg.type
      setEvents(prev => [
        {
          id:    crypto.randomUUID(),
          type:  msg.type,
          label: String(label),
          time:  new Date(),
        },
        ...prev.slice(0, 29), // keep last 30
      ])
    })
    return unsub
  }, [subscribe])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="card-header" style={{ marginBottom: 'var(--space-2)' }}>
        <span className="card-title">live memory stream</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <div
            className={`ws-dot ${status}`}
            style={{ width: 6, height: 6, borderRadius: '50%' }}
          />
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
            {status}
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-6) var(--space-4)',
            textAlign: 'center',
            color: 'var(--color-text-faint)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
          }}
        >
          {status === 'connected' ? 'waiting for events…' : 'not connected'}
        </div>
      ) : (
        <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 'var(--space-1)' }}>
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-2)',
                padding: 'var(--space-1) 0',
                borderBottom: '1px solid var(--color-divider)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: EVENT_COLORS[ev.type] ?? 'var(--color-text-faint)',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <span style={{ color: 'var(--color-text-faint)', flexShrink: 0 }}>
                {ev.time.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{ color: 'var(--color-primary)', flexShrink: 0 }}>{ev.type}</span>
              <span style={{ color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
