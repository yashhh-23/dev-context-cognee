'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type WsStatus = 'connected' | 'connecting' | 'disconnected'

export interface WsMessage {
  type:    string
  payload: unknown
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'
const MAX_RETRIES    = 5
const BASE_DELAY_MS  = 1000

/**
 * useWebSocket — singleton WebSocket manager with exponential backoff reconnect.
 * Exposes connection status and a subscribe callback.
 */
export function useWebSocket() {
  const [status,   setStatus]   = useState<WsStatus>('disconnected')
  const wsRef                   = useRef<WebSocket | null>(null)
  const retryRef                = useRef(0)
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlersRef             = useRef<Set<(msg: WsMessage) => void>>(new Set())

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    const ws = new WebSocket(`${WS_URL}/ws/notifications`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      retryRef.current = 0
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsMessage
        handlersRef.current.forEach(h => h(msg))
      } catch { /* non-JSON frame — ignore */ }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      if (retryRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryRef.current)
        retryRef.current += 1
        // eslint-disable-next-line react-hooks/immutability -- reconnect intentionally schedules the stable callback.
        timerRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const subscribe = useCallback((handler: (msg: WsMessage) => void) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { status, subscribe, send }
}
