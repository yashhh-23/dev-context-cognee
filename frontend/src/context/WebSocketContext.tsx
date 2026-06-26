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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/notifications'

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WSStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  
  const wsRef = useRef<WebSocket | null>(null)
  const historyRef = useRef<any[]>([]) // persist last 50 messages in ref
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    setStatus(reconnectAttempts > 0 ? 'reconnecting' : 'connecting')
    
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] connected to', WS_URL)
        setStatus('connected')
        setReconnectAttempts(0)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
          
          // Persist in history (max 50)
          historyRef.current = [data, ...historyRef.current].slice(0, 50)
        } catch (e) {
          console.error('[WS] parse message error:', e)
        }
      }

      ws.onclose = () => {
        console.log('[WS] closed')
        setStatus('disconnected')
        scheduleReconnect()
      }

      ws.onerror = (err) => {
        console.error('[WS] error:', err)
        ws.close()
      }
    } catch (e) {
      console.error('[WS] connection failed:', e)
      setStatus('disconnected')
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(2 ** (reconnectAttempts + 1) * 1000, 30000)
    console.log(`[WS] reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts + 1})`)
    
    setReconnectAttempts(prev => prev + 1)

    reconnectTimeoutRef.current = setTimeout(() => {
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
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect loop on unmount
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
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
