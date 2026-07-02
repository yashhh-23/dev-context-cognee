'use client'

import { useIngestProgress } from '@/hooks/useIngestProgress'

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '2.5px solid var(--color-border)',
        borderTopColor: 'var(--color-primary)',
        animation: 'ingest-spin 0.75s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

interface ProgressBarProps {
  value: number // 0–100
}

function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: '100%',
        height: 5,
        background: 'var(--color-border)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: '100%',
          background:
            value >= 100
              ? 'var(--color-success, #4ade80)'
              : 'linear-gradient(90deg, var(--color-primary) 0%, #38bdf8 100%)',
          borderRadius: 'var(--radius-full)',
          transition: 'width 0.35s ease',
        }}
      />
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'color-mix(in srgb, var(--color-error, #f87171) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-error, #f87171) 40%, transparent)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-error, #f87171)',
        animation: 'ingest-fadeIn 0.25s ease-out',
      }}
    >
      {/* Error icon */}
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <div style={{ flex: 1, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 2 }}>ingestion failed</div>
        <div style={{ color: 'var(--color-text-muted)', wordBreak: 'break-word' }}>{message}</div>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: 'var(--color-error, #f87171)',
          opacity: 0.7,
          lineHeight: 1,
          flexShrink: 0,
          fontSize: 16,
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * IngestProgress
 *
 * Conditionally renders an ingestion status panel by consuming the
 * useIngestProgress hook. The component is completely self-contained —
 * simply mount it anywhere in the tree and it reacts to the global
 * WebSocket stream automatically.
 *
 * Visibility rules:
 *   • isIngesting === true  → show spinner + progress bar + statusLabel
 *   • error !== null        → show ErrorBanner (dismissible)
 *   • neither               → render nothing (zero layout impact)
 */
export default function IngestProgress() {
  const { isIngesting, progress, statusLabel, error, reset } = useIngestProgress()

  // Nothing to show — zero layout footprint
  if (!isIngesting && !error) return null

  return (
    <>
      {/* Keyframe styles injected once per mount */}
      <style>{`
        @keyframes ingest-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ingest-fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ingest-shimmer {
          0%   { opacity: 0.6; }
          50%  { opacity: 1;   }
          100% { opacity: 0.6; }
        }
      `}</style>

      {error ? (
        <ErrorBanner message={error} onDismiss={reset} />
      ) : (
        /* Active ingestion panel */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface, #1a1a2e))',
            border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
            borderRadius: 'var(--radius-md)',
            animation: 'ingest-fadeIn 0.25s ease-out',
          }}
        >
          {/* Header row: spinner + label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <Spinner />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 2,
                }}
              >
                cognify — knowledge ingestion
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-primary)',
                  animation: 'ingest-shimmer 1.6s ease-in-out infinite',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {statusLabel || 'Initialising…'}
              </div>
            </div>

            {/* Numeric percentage badge */}
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                color: 'var(--color-primary)',
                flexShrink: 0,
                minWidth: 36,
                textAlign: 'right',
              }}
            >
              {progress}%
            </span>
          </div>

          {/* Fluid progress bar */}
          <ProgressBar value={progress} />
        </div>
      )}
    </>
  )
}
