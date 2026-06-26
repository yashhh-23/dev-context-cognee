'use client'

import { useHealth } from '@/hooks/useHealth'

export default function BackendStatusBanner() {
  const { isHealthy, loading, checkImmediate } = useHealth()

  if (isHealthy) return null

  return (
    <div
      role="alert"
      style={{
        width: '100%',
        background: 'rgba(217, 119, 6, 0.15)',
        borderBottom: '1px solid rgba(217, 119, 6, 0.4)',
        padding: 'var(--space-2) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: '#f59e0b',
        zIndex: 9999,
        position: 'sticky',
        top: 0,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ fontSize: '14px' }}>⚠️</span>
      <span style={{ flexShrink: 1, textAlign: 'center' }}>
        Backend is starting up (Render free tier cold start — usually takes 30–50s).
      </span>
      <button
        onClick={checkImmediate}
        disabled={loading}
        style={{
          background: 'rgba(217, 119, 6, 0.2)',
          border: '1px solid rgba(217, 119, 6, 0.4)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-1) var(--space-2)',
          color: '#f59e0b',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
        onMouseEnter={e => {
          if (!loading) e.currentTarget.style.background = 'rgba(217, 119, 6, 0.3)'
        }}
        onMouseLeave={e => {
          if (!loading) e.currentTarget.style.background = 'rgba(217, 119, 6, 0.2)'
        }}
      >
        {loading ? (
          <>
            <span className="spinner" />
            <span>checking...</span>
          </>
        ) : (
          <span>retry now</span>
        )}
      </button>

      <style jsx>{`
        .spinner {
          width: 8px;
          height: 8px;
          border: 1px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          display: inline-block;
          animation: spin 0.75s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
