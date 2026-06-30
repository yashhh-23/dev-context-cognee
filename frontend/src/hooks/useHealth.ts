'use client'

import { useCallback, useEffect, useState } from 'react'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn("[health] NEXT_PUBLIC_API_URL not set")
}

export function useHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)

  const checkImmediate = useCallback(async () => {
    setLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const res = await fetch(`${BASE}/health`, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        setIsHealthy(data.status === 'ok')
      } else {
        setIsHealthy(false)
      }
    } catch (err) {
      clearTimeout(timeoutId)
      console.warn('[useHealth] Backend health check failed:', err)
      setIsHealthy(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Run initial check
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial check on mount
    checkImmediate()

    // Poll every 15 seconds
    const intervalId = setInterval(() => {
      checkImmediate()
    }, 15000)

    return () => {
      clearInterval(intervalId)
    }
  }, [checkImmediate])

  return { isHealthy, loading, checkImmediate }
}
