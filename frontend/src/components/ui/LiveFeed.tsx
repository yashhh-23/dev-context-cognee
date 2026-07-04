'use client'

import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from '@/lib/ws'

interface FeedEvent {
  id:      string
  type:    string
  label:   string
  time:    Date
}

const EVENT_COLORS: Record<string, string> = {
  memory_stored:   '#2dd4bf', // teal
  memory_recalled: '#38bdf8', // light blue
  bug_opened:      '#f87171', // red
  bug_closed:      '#4ade80', // green
  session_started: '#fb7185', // rose
  graph_built:     '#a78bfa', // purple
  INGEST:          '#f59e0b', // amber
  INGEST_SUCCESS:  '#4ade80', // green
  INGEST_ERROR:    '#f87171', // red
}

export default function LiveFeed() {
  const { status, lastMessage } = useWebSocket()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [showScrollButton, setShowScrollButton] = useState(false)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(true)

  // Listen to incoming messages from the shared WebSocket
  useEffect(() => {
    if (!lastMessage) return

    const payload = lastMessage.payload as Record<string, string> | null
    const label = payload?.label ?? payload?.message ?? payload?.description ?? lastMessage.type
    
    const newEvent: FeedEvent = {
      id: crypto.randomUUID(),
      type: lastMessage.type || 'EVENT',
      label: String(label),
      time: new Date(),
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- state update in effect
    setEvents(prev => [...prev, newEvent].slice(-100)) // Keep last 100 events

    // If auto-scrolling is enabled, scroll to bottom on new message
    if (isAutoScrolling.current) {
      setTimeout(scrollToBottom, 50)
    } else {
      setShowScrollButton(true)
    }
  }, [lastMessage])

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setShowScrollButton(false)
      isAutoScrolling.current = true
    }
  }

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    
    // If user is within 30px of the bottom, lock scroll to bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30
    isAutoScrolling.current = isAtBottom
    
    if (isAtBottom) {
      setShowScrollButton(false)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
      <div className="card-header" style={{ marginBottom: 'var(--space-3)' }}>
        <span className="card-title">live memory stream</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: status === 'connected' ? '#2dd4bf' : status === 'reconnecting' ? '#eab308' : '#f87171',
              display: 'inline-block',
              animation: status === 'reconnecting' ? 'spin 1s linear infinite' : undefined,
            }}
          />
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
            {status}
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1 }}>
        {events.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-10) var(--space-4)',
              textAlign: 'center',
              color: 'var(--color-text-faint)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
            }}
          >
            {status === 'connected' ? 'waiting for events…' : 'waiting for connection…'}
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              height: '220px',
              overflowY: 'auto',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              scrollBehavior: 'smooth',
            }}
          >
            {events.map(ev => (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  lineHeight: 1.5,
                  animation: 'fadeIn 0.2s ease-out',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: EVENT_COLORS[ev.type] ?? 'var(--color-text-faint)',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                />
                <span style={{ color: 'var(--color-text-faint)', flexShrink: 0, fontSize: '10px' }}>
                  {ev.time.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span
                  style={{
                    color: EVENT_COLORS[ev.type] ?? 'var(--color-text-muted)',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    fontSize: '10px',
                  }}
                >
                  [{ev.type}]
                </span>
                <span
                  style={{
                    color: 'var(--color-text)',
                    wordBreak: 'break-all',
                    flex: 1,
                  }}
                >
                  {ev.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Floating scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'absolute',
              bottom: 'var(--space-2)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-primary)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: 'var(--space-1) var(--space-3)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              animation: 'bounce 1s infinite',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>↓ new events</span>
          </button>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -4px); }
        }
      `}</style>
    </div>
  )
}
