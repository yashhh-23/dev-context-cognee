'use client';
import { useEffect, useRef, useCallback } from 'react';

type Handler = (data: Record<string, unknown>) => void;

export function useWebSocket(onMessage: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000);

  const connect = useCallback(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
      .replace(/^http/, 'ws');
    const ws = new WebSocket(`${base}/ws/notifications`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessage(data);
      } catch {}
    };

    ws.onopen = () => { retryDelay.current = 1000; };

    ws.onclose = () => {
      retryRef.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
        connect();
      }, retryDelay.current);
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 20000);

    ws.onerror = () => { clearInterval(ping); ws.close(); };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);
}
