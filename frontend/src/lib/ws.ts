'use client'

import { useWebSocketContext, type WSStatus } from '@/context/WebSocketContext'

export type WsStatus = WSStatus

export interface WsMessage {
  type:    string
  payload: unknown
}

/**
 * useWebSocket — consumes the global WebSocket context for a single shared connection.
 */
export function useWebSocket() {
  const { status, lastMessage, send } = useWebSocketContext()
  return { status, lastMessage, send }
}
