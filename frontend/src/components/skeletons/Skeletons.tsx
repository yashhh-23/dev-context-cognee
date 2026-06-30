'use client'

import React from 'react'

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton ${className || ''}`}
      style={{
        background: 'var(--color-surface-offset)',
        borderRadius: 'var(--radius-sm)',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    >
      <style jsx global>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          style={{
            height: '12px',
            width: i === lines - 1 ? '70%' : '100%',
            borderRadius: '4px',
          }}
        />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton style={{ height: '16px', width: '30%', borderRadius: '4px' }} />
        <Skeleton style={{ height: '16px', width: '15%', borderRadius: '4px' }} />
      </div>
      <SkeletonText lines={3} />
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
        <Skeleton style={{ height: '20px', width: '50px', borderRadius: 'var(--radius-full)' }} />
        <Skeleton style={{ height: '20px', width: '60px', borderRadius: 'var(--radius-full)' }} />
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton style={{ height: '18px', width: '20%' }} />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Skeleton style={{ height: '14px', width: '40px' }} />
          <Skeleton style={{ height: '14px', width: '40px' }} />
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            style={{
              flex: 1,
              height: `${20 + Math.sin(i) * 30 + 40}%`,
              borderRadius: '4px 4px 0 0',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Stats Row */}
      <div className="grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Skeleton style={{ height: '12px', width: '50%' }} />
            <Skeleton style={{ height: '28px', width: '40%', marginTop: '4px' }} />
            <Skeleton style={{ height: '10px', width: '70%', marginTop: '2px' }} />
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid-2" style={{ alignItems: 'start', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <ChartSkeleton />
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Skeleton style={{ height: '18px', width: '30%' }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '60%' }}>
                  <Skeleton style={{ height: '12px', width: '90%' }} />
                  <Skeleton style={{ height: '10px', width: '50%' }} />
                </div>
                <Skeleton style={{ height: '16px', width: '15%' }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Skeleton style={{ height: '18px', width: '40%' }} />
            <Skeleton style={{ height: '60px', width: '100%' }} />
            <Skeleton style={{ height: '36px', width: '120px' }} />
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Skeleton style={{ height: '18px', width: '35%' }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <Skeleton style={{ height: '24px', width: '24px', borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Skeleton style={{ height: '12px', width: '40%' }} />
                  <Skeleton style={{ height: '10px', width: '90%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
