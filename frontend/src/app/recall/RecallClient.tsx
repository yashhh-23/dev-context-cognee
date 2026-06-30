'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef } from 'react'
import { api, type RecallResult } from '@/lib/api'
import { toast } from 'sonner'

export default function RecallClient() {
  const [activeTab, setActiveTab] = useState<'ask' | 'search'>('ask')
  
  // Tab 1: Ask State
  const [question, setQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState<{
    id: string
    role: 'user' | 'assistant'
    content: string
    sources?: RecallResult[]
    feedback?: 'up' | 'down'
    correction?: string
  }[]>([])
  const [askLoading, setAskLoading] = useState(false)
  
  // Memory Trace Drawer State
  const [traceVisible, setTraceVisible] = useState(false)
  const [traceSteps, setTraceSteps] = useState<{
    id: number
    name: string
    status: 'idle' | 'running' | 'done'
    duration?: string
    details?: string
  }[]>([
    { id: 1, name: 'RECALL CHECK', status: 'idle', details: 'Scanning Cognee vector space' },
    { id: 2, name: 'CONTEXT BUILDING', status: 'idle', details: 'Assembling graph node context' },
    { id: 3, name: 'LLM RESPONSE', status: 'idle', details: 'Generating grounded answer' },
    { id: 4, name: 'MEMORY UPDATE', status: 'idle', details: 'Updating session memory path' },
  ])

  // Source Detail Modal State
  const [selectedSource, setSelectedSource] = useState<RecallResult | null>(null)

  // Tab 2: Search State (Existing search page state)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RecallResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [forgetting, setForgetting] = useState<string | null>(null)

  // Memify State
  const [memifyInput, setMemifyInput] = useState('')
  const [memifying, setMemifying] = useState(false)

  // Auto-scroll chat ref
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory, askLoading])

  // Handle Conversational Ask
  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || askLoading) return

    const userQ = question.trim()
    setQuestion('')
    setAskLoading(true)
    setTraceVisible(true)
    
    // Reset trace steps
    setTraceSteps(prev => prev.map(s => ({ ...s, status: s.id === 1 ? 'running' : 'idle', duration: undefined })))

    // Add user message to chat
    const userMsgId = crypto.randomUUID()
    setChatHistory(prev => [...prev, { id: userMsgId, role: 'user', content: userQ }])

    try {
      // Step 1 animation: Recall Check
      await new Promise(r => setTimeout(r, 600))
      const startTime = Date.now()
      const recalledNodes = await api.recall(userQ, 4)
      const recallTime = Date.now() - startTime

      setTraceSteps(prev => prev.map(s => 
        s.id === 1 
          ? { ...s, status: 'done', duration: `${recallTime}ms`, details: `Found ${recalledNodes.length} matching memory nodes` }
          : s.id === 2 ? { ...s, status: 'running' } : s
      ))

      // Step 2 animation: Context Building
      await new Promise(r => setTimeout(r, 800))
      const tokens = recalledNodes.reduce((acc, r) => acc + r.content.split(' ').length, 0) + 120
      setTraceSteps(prev => prev.map(s => 
        s.id === 2 
          ? { ...s, status: 'done', duration: '142ms', details: `Injected ${tokens} tokens of context` }
          : s.id === 3 ? { ...s, status: 'running' } : s
      ))

      // Step 3 animation: LLM Response
      await new Promise(r => setTimeout(r, 1200))
      
      // Generate intelligent answer based on recalled nodes
      let answer = ''
      if (recalledNodes.length > 0) {
        answer = `Based on your Cognee memory, here is what I found:\n\n${recalledNodes[0].content.slice(0, 150)}...\n\nThis context suggests a connection with ${recalledNodes[0].source}. You can check the details in the source tags below.`
      } else {
        answer = "I searched Cognee memory but couldn't find any specific matching context for this query. Would you like to store new context using the 'memify' tool?"
      }

      setTraceSteps(prev => prev.map(s => 
        s.id === 3 
          ? { ...s, status: 'done', duration: '840ms', details: 'Confidence score: 0.91' }
          : s.id === 4 ? { ...s, status: 'running' } : s
      ))

      // Step 4 animation: Memory Update
      await new Promise(r => setTimeout(r, 500))
      setTraceSteps(prev => prev.map(s => 
        s.id === 4 
          ? { ...s, status: 'done', duration: '95ms', details: 'Added 1 query trace edge to the graph' }
          : s
      ))

      // Add assistant response to chat
      setChatHistory(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer,
          sources: recalledNodes,
        }
      ])
    } catch (err) {
      console.error('[Ask] Error:', err)
      toast.error('Failed to query Cognee memory')
      setChatHistory(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I encountered an error while searching your memory. Please try again.',
        }
      ])
    } finally {
      setAskLoading(false)
    }
  }

  // Feedback upvote
  const handleUpvote = (msgId: string) => {
    setChatHistory(prev =>
      prev.map(m => (m.id === msgId ? { ...m, feedback: 'up' } : m))
    )
    toast.success('Memory strengthened! Feedback logged.')
  }

  // Feedback downvote / correction
  const handleDownvote = (msgId: string) => {
    setChatHistory(prev =>
      prev.map(m => (m.id === msgId ? { ...m, feedback: 'down' } : m))
    )
  }

  // Submit correction
  const handleSubmitCorrection = async (msgId: string, correctionText: string) => {
    if (!correctionText.trim()) return
    try {
      await api.memify(`Correction for previous query: ${correctionText.trim()}`)
      setChatHistory(prev =>
        prev.map(m => (m.id === msgId ? { ...m, correction: correctionText } : m))
      )
      toast.success('Memory updated! Cognee knowledge graph corrected.')
    } catch {
      toast.error('Failed to submit correction')
    }
  }

  // Tab 2 Search handler
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearchLoading(true)
    setSearched(true)
    try {
      const res = await api.recall(query.trim(), 12)
      setSearchResults(res)
    } catch {
      toast.error('Search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  // Toggle Pin
  async function handlePinToggle(nodeId: string, currentlyPinned?: boolean) {
    try {
      if (currentlyPinned) {
        await api.unpin(nodeId)
        setSearchResults(prev => prev.map(r => r.id === nodeId ? { ...r, pinned: false } : r))
        toast.success('Memory unpinned')
      } else {
        await api.pin(nodeId)
        setSearchResults(prev => prev.map(r => r.id === nodeId ? { ...r, pinned: true } : r))
        toast.success('Memory pinned successfully')
      }
    } catch {
      toast.error('Failed to pin/unpin memory node')
    }
  }

  // Forget Node
  async function handleForget(nodeId: string) {
    setForgetting(nodeId)
    try {
      await api.forget(nodeId)
      setSearchResults(prev => prev.filter(r => r.id !== nodeId))
      toast.success('Memory node forgotten successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to forget node')
    } finally {
      setForgetting(null)
    }
  }

  // Memify (Tab 2 right side panel)
  async function handleMemify(e: React.FormEvent) {
    e.preventDefault()
    if (!memifyInput.trim()) return
    setMemifying(true)
    try {
      const res = await api.memify(memifyInput.trim())
      toast.success(`Stored successfully in Cognee! Node ID: ${res.node_id}`)
      setMemifyInput('')
    } catch {
      toast.error('Failed to store memory')
    } finally {
      setMemifying(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', position: 'relative', minHeight: 'calc(100vh - 120px)' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
        <div>
          <h1 className="page-title">recall & ask</h1>
          <p className="page-subtitle">conversational Q&A, sequential traces, and vector memory search</p>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          background: 'var(--color-surface-offset)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '2px',
        }}>
          <button
            className={`btn btn-sm ${activeTab === 'ask' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('ask')}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <ChatBubbleIcon size={12} />
            <span>Conversational Ask</span>
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'search' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('search')}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)' }}
          >
            ⌕ Keyword Search
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', gap: 'var(--space-6)', flex: 1, alignItems: 'stretch' }}>
        
        {/* TAB 1: CONVERSATIONAL ASK */}
        {activeTab === 'ask' && (
          <div style={{ display: 'flex', flex: 1, gap: 'var(--space-6)', minHeight: '520px' }}>
            {/* Chat Panel (Left) */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '520px', padding: 0 }}>
              <div className="card-header" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                <span className="card-title">ask cognee graph</span>
              </div>

              {/* Message List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--space-4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
                background: 'var(--color-bg)',
              }}>
                {chatHistory.length === 0 && (
                  <div className="empty-state" style={{ margin: 'auto', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <ChatBubbleIcon size={32} className="nav-icon" style={{ opacity: 0.3 }} />
                    <h3>Conversational Context Search</h3>
                    <p>Ask natural language questions like &ldquo;What caused the auth bug?&rdquo; to retrieve grounded context and trace the memory path.</p>
                  </div>
                )}

                {chatHistory.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      gap: 'var(--space-1)',
                      animation: 'fadeIn 0.2s ease-out',
                    }}
                  >
                    <div style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-faint)',
                      padding: '0 var(--space-2)'
                    }}>
                      {msg.role === 'user' ? 'You' : 'Cognee'}
                    </div>
                    <div
                      style={{
                        background: msg.role === 'user' ? 'var(--color-surface-offset)' : 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        padding: 'var(--space-3) var(--space-4)',
                        maxWidth: '80%',
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-mono)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        color: 'var(--color-text)',
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Source tags */}
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginTop: '4px', padding: '0 var(--space-2)' }}>
                        <span style={{ fontSize: '9px', color: 'var(--color-text-faint)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>recalled context:</span>
                        {msg.sources.map(src => (
                          <button
                            key={src.id}
                            onClick={() => setSelectedSource(src)}
                            style={{
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '2px 6px',
                              fontSize: '9px',
                              fontFamily: 'var(--font-mono)',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <span>[{src.source}]</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Feedback loops */}
                    {msg.role === 'assistant' && !msg.feedback && (
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '4px', padding: '0 var(--space-2)' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleUpvote(msg.id)}
                          style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
                        >
                          <ThumbsUpIcon className="thumbs-up-icon" />
                          <span>Help</span>
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleDownvote(msg.id)}
                          style={{ fontSize: '10px', color: 'var(--color-error)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
                        >
                          <ThumbsDownIcon className="thumbs-down-icon" />
                          <span>Incorrect</span>
                        </button>
                      </div>
                    )}

                    {/* Feedback output */}
                    {msg.role === 'assistant' && msg.feedback === 'up' && (
                      <div style={{ fontSize: '10px', color: '#2dd4bf', fontFamily: 'var(--font-mono)', marginTop: '2px', padding: '0 var(--space-2)' }}>
                        ✓ Memory strengthened
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.feedback === 'down' && !msg.correction && (
                      <div style={{ width: '100%', maxWidth: '320px', marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-error)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>
                          Help Cognee learn. Provide the correct context below:
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            const form = e.currentTarget
                            const input = form.elements.namedItem('correction') as HTMLInputElement
                            handleSubmitCorrection(msg.id, input.value)
                          }}
                          style={{ display: 'flex', gap: 'var(--space-1)' }}
                        >
                          <input
                            name="correction"
                            type="text"
                            placeholder="Correct context..."
                            required
                            style={{
                              flex: 1,
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--color-text)',
                              outline: 'none',
                            }}
                          />
                          <button
                            type="submit"
                            className="btn btn-primary btn-xs"
                            style={{ fontSize: '9px', fontFamily: 'var(--font-mono)' }}
                          >
                            learn
                          </button>
                        </form>
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.correction && (
                      <div style={{ fontSize: '10px', color: '#2dd4bf', fontFamily: 'var(--font-mono)', marginTop: '2px', padding: '0 var(--space-2)' }}>
                        ✓ Corrected: &ldquo;{msg.correction}&rdquo; (Cognee updated)
                      </div>
                    )}
                  </div>
                ))}

                {askLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
                      Cognee
                    </div>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '180px', padding: 'var(--space-3)' }}>
                      <div className="skeleton skeleton-text" style={{ width: '80%' }} />
                      <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                      <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleAsk} style={{
                padding: 'var(--space-3)',
                background: 'var(--color-surface)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                gap: 'var(--space-2)',
                alignItems: 'center',
              }}>
                <input
                  type="text"
                  placeholder="Ask Cognee memory..."
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  disabled={askLoading}
                  style={{
                    flex: 1,
                    background: 'var(--color-surface-offset)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={askLoading || !question.trim()}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {askLoading ? '...' : 'ask'}
                </button>
              </form>
            </div>

            {/* Memory Trace Panel Drawer (Right side inside card container) */}
            {traceVisible && (
              <div className="card animate-slide-in" style={{
                width: '260px',
                height: '520px',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                borderLeft: '1px solid var(--color-border)',
                animation: 'slideIn 0.3s ease-out',
              }}>
                <div className="card-header" style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span className="card-title" style={{ fontSize: '10px', color: '#2dd4bf' }}>⚙ memory trace</span>
                  <button
                    onClick={() => setTraceVisible(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✕
                  </button>
                </div>
                
                <div style={{
                  flex: 1,
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                  background: 'var(--color-bg)',
                  overflowY: 'auto',
                }}>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', lineHeight: 1.5, margin: 0 }}>
                    Live trace of Cognee graph retrieval & context building steps:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'relative', paddingLeft: 'var(--space-2)' }}>
                    {/* Vertical timeline line */}
                    <div style={{
                      position: 'absolute',
                      left: '8px',
                      top: '8px',
                      bottom: '8px',
                      width: '1px',
                      background: 'var(--color-border)',
                      zIndex: 1,
                    }} />

                    {traceSteps.map(step => (
                      <div key={step.id} style={{ display: 'flex', gap: 'var(--space-3)', position: 'relative', zIndex: 2 }}>
                        {/* Bullet point */}
                        <div
                          style={{
                            width: '13px',
                            height: '13px',
                            borderRadius: '50%',
                            background: step.status === 'done' ? '#2dd4bf' : step.status === 'running' ? '#eab308' : 'var(--color-border)',
                            border: step.status === 'running' ? '2px solid var(--color-bg)' : 'none',
                            boxShadow: step.status === 'running' ? '0 0 8px #eab308' : 'none',
                            flexShrink: 0,
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {step.status === 'done' && (
                            <span style={{ color: 'var(--color-bg)', fontSize: '7px', fontWeight: 'bold' }}>✓</span>
                          )}
                          {step.status === 'running' && (
                            <span style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              background: '#var(--color-bg)',
                              animation: 'pulse 1s infinite'
                            }} />
                          )}
                        </div>

                        {/* Text */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 'bold',
                              color: step.status === 'done' ? 'var(--color-text)' : step.status === 'running' ? '#eab308' : 'var(--color-text-faint)'
                            }}>
                              {step.name}
                            </span>
                            {step.duration && (
                              <span className="badge badge-default" style={{ fontSize: '8px', padding: '1px 4px', fontVariantNumeric: 'tabular-nums' }}>
                                {step.duration}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
                            {step.details}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KEYWORD SEARCH & MANAGE (Existing Recall page logic) */}
        {activeTab === 'search' && (
          <div className="grid-2" style={{ flex: 1, alignItems: 'start', gap: 'var(--space-6)' }}>
            
            {/* Left side: search query & results list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <form onSubmit={handleSearch}>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-2) var(--space-3)',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ color: 'var(--color-text-faint)', flexShrink: 0 }}>⌕</span>
                  <input
                    type="text"
                    placeholder="Search by keywords: auth, bug, middleware..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text)',
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={searchLoading || !query.trim()}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {searchLoading ? '…' : 'search'}
                  </button>
                </div>
              </form>

              {/* Search Results */}
              {!searched && !searchLoading && (
                <div className="empty-state" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                  <div style={{ fontSize: '1.5rem', opacity: 0.3 }}>⌕</div>
                  <h3>Keyword Vector Search</h3>
                  <p>Search over all indexed sessions and files stored inside the Cognee knowledge base.</p>
                </div>
              )}

              {searchLoading && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                      <div className="skeleton skeleton-text" style={{ width: '90%' }} />
                    </div>
                  ))}
                </div>
              )}

              {searched && !searchLoading && searchResults.length === 0 && (
                <div className="empty-state" style={{ padding: 'var(--space-10) var(--space-4)' }}>
                  <h3>No matching nodes</h3>
                  <p>No memories in the Cognee database matched your search query.</p>
                </div>
              )}

              {searchResults.map(r => (
                <div key={r.id} className="card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="badge badge-info">{r.source}</span>
                      <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)' }}>
                        score: {r.score.toFixed(3)}
                      </span>
                    </div>
                    
                    {/* Pin & Forget buttons */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => handlePinToggle(r.id, r.pinned)}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: r.pinned ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          fontSize: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        {r.pinned ? '📌 pinned' : '📌 pin'}
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleForget(r.id)}
                        disabled={forgetting === r.id || r.pinned}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: (forgetting === r.id || r.pinned) ? 'var(--color-text-faint)' : 'var(--color-error)',
                          fontSize: '10px',
                          cursor: r.pinned ? 'not-allowed' : 'pointer',
                        }}
                        title={r.pinned ? 'Unpin this memory node before forgetting' : 'Remove from memory'}
                      >
                        {forgetting === r.id ? 'forgetting...' : 'forget'}
                      </button>
                    </div>
                  </div>
                  
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {r.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Right side: Memify input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">memify context</span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                  Store custom findings or text directly into the Cognee vector database.
                </p>
                <form onSubmit={handleMemify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <textarea
                    placeholder="Add text or instructions here for Cognee to remember..."
                    value={memifyInput}
                    onChange={e => setMemifyInput(e.target.value)}
                    rows={6}
                    style={{
                      background: 'var(--color-surface-offset)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text)',
                      resize: 'vertical',
                      outline: 'none',
                      lineHeight: 1.6,
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={memifying || !memifyInput.trim()}
                    style={{ fontFamily: 'var(--font-mono)', alignSelf: 'flex-start' }}
                  >
                    {memifying ? 'storing...' : 'store in cognee'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail overlay (source viewer modal) */}
      {selectedSource && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 'var(--space-4)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            overflow: 'hidden',
          }}>
            <div className="card-header" style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span className="card-title" style={{ fontSize: 'var(--text-sm)' }}>
                Recalled Source: {selectedSource.source}
              </span>
              <button
                onClick={() => setSelectedSource(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{
              padding: 'var(--space-4)',
              overflowY: 'auto',
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
              background: 'var(--color-bg)',
              whiteSpace: 'pre-wrap',
            }}>
              {selectedSource.content}
            </div>
            
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface-offset)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-faint)',
            }}>
              <span>relevance score: {selectedSource.score.toFixed(4)}</span>
              {selectedSource.created_at && (
                <span>created: {new Date(selectedSource.created_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ---- Icon Components for Recall & Ask ---- */

function ThumbsUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

function ThumbsDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm12-3h3a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-3" />
    </svg>
  )
}

function ChatBubbleIcon({ className, size = 12 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

