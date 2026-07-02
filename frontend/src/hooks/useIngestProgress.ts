'use client'

import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from '@/lib/ws'

// Payload shapes ---------------------------------------------------------------

interface IngestProgressPayload {
  progress:    number
  description: string
}

interface IngestSuccessPayload {
  message?: string
}

interface IngestErrorPayload {
  description?: string
  error?:       string
}

// Hook return type -------------------------------------------------------------

export interface IngestProgressState {
  isIngesting: boolean
  progress:    number
  statusLabel: string
  error:       string | null
  reset:       () => void
}

// Hook implementation ----------------------------------------------------------

/**
 * useIngestProgress
 *
 * Subscribes to the global shared WebSocket context and reacts to cognee
 * ingestion lifecycle events emitted by the FastAPI WS manager:
 *
 *   INGEST_PROGRESS — ongoing sub-task update with numeric progress (0-100)
 *   INGEST_SUCCESS  — pipeline completed successfully
 *   INGEST_ERROR    — pipeline aborted with an error description
 *
 * Reuses the existing global WebSocket connection (WebSocketContext) so that
 * no second socket is opened, which aligns with the LiveFeed pattern.
 */
export function useIngestProgress(): IngestProgressState {
  const { lastMessage } = useWebSocket()

  const [isIngesting, setIsIngesting] = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [statusLabel, setStatusLabel] = useState('')
  const [error,       setError]       = useState<string | null>(null)

  // Stable ref so effect handlers never capture stale state setters
  const settersRef = useRef({ setIsIngesting, setProgress, setStatusLabel, setError })
  useEffect(() => {
    settersRef.current = { setIsIngesting, setProgress, setStatusLabel, setError }
  })

  useEffect(() => {
    if (!lastMessage) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const type: string = (lastMessage as any).type ?? ''

    switch (type) {
      case 'INGEST_PROGRESS': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = ((lastMessage as any).payload ?? {}) as Partial<IngestProgressPayload>
        const nextProgress =
          typeof p.progress === 'number' ? Math.max(0, Math.min(100, p.progress)) : 0

        setIsIngesting(true)
        setProgress(nextProgress)
        setStatusLabel(p.description ?? 'Processing…')
        setError(null)
        break
      }

      case 'INGEST_SUCCESS': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = ((lastMessage as any).payload ?? {}) as Partial<IngestSuccessPayload>
        setIsIngesting(false)
        setProgress(100)
        setStatusLabel(p.message ?? 'Ingestion complete.')
        setError(null)

        // Briefly show the 100 % completed state, then clear so the panel exits
        const timer = setTimeout(() => {
          settersRef.current.setStatusLabel('')
          settersRef.current.setProgress(0)
        }, 2400)
        return () => clearTimeout(timer)
      }

      case 'INGEST_ERROR': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = ((lastMessage as any).payload ?? {}) as Partial<IngestErrorPayload>
        const description =
          p.description ?? p.error ?? 'An unknown error occurred during ingestion.'
        setIsIngesting(false)
        setProgress(0)
        setStatusLabel('')
        setError(description)
        break
      }

      default:
        break
    }
  }, [lastMessage])

  const reset = () => {
    setIsIngesting(false)
    setProgress(0)
    setStatusLabel('')
    setError(null)
  }

  return { isIngesting, progress, statusLabel, error, reset }
}
