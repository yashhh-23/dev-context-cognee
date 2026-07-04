'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

interface WebSocketContextType {
  status: WSStatus
  lastMessage: any
  send: (msg: any) => void
  reconnectAttempts: number
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

const getWsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    let url = process.env.NEXT_PUBLIC_WS_URL.replace(/\/+$/, '')
    if (!url.endsWith('/ws') && !url.endsWith('/ws/notifications')) {
      url += '/ws/notifications'
    }
    return url
  }
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws/notifications`
  }
  return 'ws://localhost:8000/ws/notifications'
}
const WS_URL = getWsUrl()

if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_WS_URL) {
  console.warn("[WS] NEXT_PUBLIC_WS_URL not set" + (process.env.NODE_ENV !== 'production' ? ", using localhost fallback" : ""))
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WSStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(true)

  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts
  }, [reconnectAttempts])

  const connect = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    setStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting')
    
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] connected to', WS_URL)
        setStatus('connected')
        reconnectAttemptsRef.current = 0
        setReconnectAttempts(0)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
        } catch (e) {
          console.error('[WS] parse message error:', e)
        }
      }

      ws.onclose = () => {
        console.log('[WS] closed')
        wsRef.current = null
        setStatus('disconnected')
        if (shouldReconnectRef.current) {
          scheduleReconnect()
        }
      }

      ws.onerror = () => {
        if (reconnectAttemptsRef.current === 0) {
          console.warn('[WS] Backend unreachable; running in offline/demo mode')
        }
        ws.close()
      }
    } catch (e) {
      console.error('[WS] connection failed:', e)
      setStatus('disconnected')
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    const nextAttempt = reconnectAttemptsRef.current + 1

    if (nextAttempt > 10) {
      console.warn("[WS] Max reconnect reached")
      return
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(2 ** nextAttempt * 1000, 30000)
    console.log(`[WS] reconnecting in ${delay / 1000}s (attempt ${nextAttempt})`)
    
    reconnectAttemptsRef.current = nextAttempt
    setReconnectAttempts(nextAttempt)

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null
      connect()
    }, delay)
  }

  const send = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } else {
      console.warn('[WS] cannot send message, socket not open')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial connection on mount
    connect()
    return () => {
      shouldReconnectRef.current = false
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect loop on unmount
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <WebSocketContext.Provider value={{ status, lastMessage, send, reconnectAttempts }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext)
  if (!ctx) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider')
  }
  return ctx
}
