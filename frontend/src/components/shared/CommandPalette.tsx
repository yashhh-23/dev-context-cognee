'use client'

import React, { useState, useEffect, useRef } from 'react'
import { api, RecallResult } from '@/lib/api'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut'

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RecallResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Toggle palette open/close on Cmd+K / Ctrl+K
  useGlobalShortcut('k', () => {
    setIsOpen(prev => !prev)
  })

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setResults([])
      setActiveIndex(0)
    }
  }, [isOpen])

  // Debounced search logic
  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }

    setLoading(true)
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.searchMemory(query, 8)
        setResults(res)
        setActiveIndex(0)
      } catch (err) {
        console.error('Quick recall search failed:', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [query])

  // Handle arrow keys and Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = results[activeIndex]
      if (selected) {
        // Highlight/copy or perform action
        navigator.clipboard.writeText(selected.content)
        alert(`Copied context to clipboard:\n"${selected.content.slice(0, 100)}..."`)
        setIsOpen(false)
      }
    }
  }

  // Click outside listener
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 9, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 100,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '600px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ marginRight: 'var(--space-3)', fontSize: '18px', color: 'var(--color-text-faint)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to search memory (Cmd+K)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text)',
            }}
          />
          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', border: '1px solid var(--color-divider)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
            ESC
          </div>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '350px', overflowY: 'auto', padding: 'var(--space-2)' }}>
          {loading && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              Searching Cognee graph...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              No matching memories found.
            </div>
          )}

          {!query && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              Search for project keywords, tags, or error messages. Press Enter to copy to clipboard.
            </div>
          )}

          {!loading && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {results.map((item, idx) => {
                const isActive = idx === activeIndex
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      navigator.clipboard.writeText(item.content)
                      setIsOpen(false)
                    }}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'var(--color-surface-offset)' : 'transparent',
                      border: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        background: 'rgba(88, 166, 255, 0.15)',
                        color: '#58a6ff',
                        textTransform: 'uppercase',
                      }}>
                        {item.source}
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
                        score: {item.score.toFixed(2)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {item.content}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
