'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, ExternalLink, PenLine } from 'lucide-react'
import type { Signal } from '@/lib/supabase'
import { getTopicColor } from '@/lib/topic-colors'

type Topic = { label: string; query: string }

const STORAGE_KEY = 'arc:feed-topics'
const STREAM_DELAY = 100

const DEFAULT_TOPICS: Topic[] = [
  { label: 'Marketing', query: 'Marketing' },
  { label: 'AI', query: 'AI' },
]

// Format relative time
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 30) return `${diffDays}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Get topics from localStorage
function getStoredTopics(): Topic[] {
  if (typeof window === 'undefined') return DEFAULT_TOPICS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TOPICS))
    return DEFAULT_TOPICS
  } catch {
    return DEFAULT_TOPICS
  }
}

// Save topics to localStorage
function saveTopics(topics: Topic[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(topics))
}

// Skeleton Card
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)',
      background: '#111', height: 280, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 140,
        background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
        backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
      }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          height: 16, background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 4, width: '90%',
        }} />
        <div style={{
          height: 12, background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 4, width: '70%',
        }} />
        <div style={{
          height: 12, background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 4, width: '50%', marginTop: 'auto',
        }} />
      </div>
      <style jsx>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

// Reading Drawer Component
function ReadingDrawer({ signal, isOpen, onClose, onWrite }: { 
  signal: Signal | null
  isOpen: boolean
  onClose: () => void
  onWrite: (s: Signal) => void
}) {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      document.body.style.overflow = 'hidden'
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      document.body.style.overflow = ''
      return () => clearTimeout(timer)
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])
  
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
  
  if (!isVisible || !signal) return null
  
  const relScore = (signal as Signal & { relevance_score?: number }).relevance_score || 0
  const badge = relScore >= 30 
    ? { text: 'High Impact', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    : relScore >= 15
    ? { text: 'Relevant', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
    : { text: 'Trending', color: '#a1a1aa', bg: 'rgba(255,255,255,0.08)' }
  
  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)', zIndex: 40,
          opacity: isOpen ? 1 : 0, transition: 'opacity 0.3s ease',
        }}
      />
      
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 600,
        background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
              background: badge.bg, color: badge.color, border: `1px solid ${badge.color}33`,
            }}>
              {badge.text}
            </span>
            <span style={{ fontSize: 12, color: '#666' }}>
              {formatRelativeTime(signal.published_date)}
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', color: '#888', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Image */}
          {signal.image_url && (
            <div style={{
              width: '100%', height: 200, borderRadius: 12, overflow: 'hidden',
              marginBottom: 24, background: '#111',
            }}>
              <img 
                src={signal.image_url} alt="" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
          
          {/* Title */}
          <h1 style={{
            fontSize: 22, fontWeight: 600, color: 'white', margin: '0 0 16px',
            lineHeight: 1.4,
          }}>
            {signal.title}
          </h1>
          
          {/* Source */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            {signal.favicon && (
              <img src={signal.favicon} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />
            )}
            <span style={{ fontSize: 13, color: '#888' }}>{signal.source_name}</span>
          </div>
          
          {/* Excerpt / Content */}
          <div style={{
            fontSize: 15, color: '#aaa', lineHeight: 1.7,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {signal.snippet ? (
              <p>{signal.snippet}</p>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                No preview available. Open the original source to read the full article.
              </p>
            )}
          </div>
        </div>
        
        {/* Footer Actions */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={() => window.open(signal.url, '_blank')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: '#aaa',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' }}
          >
            <ExternalLink size={14} />
            Open Original
          </button>
          
          <button
            onClick={() => { onWrite(signal); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 8,
              border: 'none',
              background: 'white', color: 'black',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <PenLine size={14} />
            Write about this
          </button>
        </div>
      </div>
    </>
  )
}

export default function FeedPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>([])
  const [visibleCount, setVisibleCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [topics, setTopics] = useState<Topic[]>([])
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [hoveredChip, setHoveredChip] = useState<string | null>(null)
  const [readingSignal, setReadingSignal] = useState<Signal | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<boolean>(false)

  useEffect(() => {
    setTopics(getStoredTopics())
    loadFeed(null)
  }, [])

  useEffect(() => {
    if (showAdd) addInputRef.current?.focus()
  }, [showAdd])

  async function loadFeed(topic: Topic | null) {
    abortRef.current = true
    setSignals([])
    setVisibleCount(0)
    setIsLoading(true)
    abortRef.current = false
    
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-signals', topic: topic?.query })
      })
      
      const data = await res.json()
      const signalsArray = Array.isArray(data?.signals) ? data.signals : []
      setSignals(signalsArray)
      
      for (let i = 0; i < signalsArray.length; i++) {
        if (abortRef.current) break
        await new Promise(resolve => setTimeout(resolve, STREAM_DELAY))
        setVisibleCount(prev => prev + 1)
      }
    } catch(e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  // Selecting a topic does NOT refetch — it filters the already-loaded signals
  // client-side so the keyword filter is rigorous and instant.
  function selectTopic(t: Topic | null) {
    setActiveTopic(t)
  }

  function addTopic() {
    const label = newLabel.trim()
    if (!label) return
    const next = [...topics, { label, query: label }]
    setTopics(next)
    saveTopics(next)
    setNewLabel('')
    setShowAdd(false)
  }

  function deleteTopic(e: React.MouseEvent, topicToDelete: Topic) {
    e.stopPropagation()
    const next = topics.filter(t => t.label !== topicToDelete.label)
    setTopics(next)
    saveTopics(next)
    
    if (activeTopic?.label === topicToDelete.label) {
      setActiveTopic(null)
    }
  }
  
  const handleWrite = useCallback((s: Signal) => {
    router.push('/dashboard/write?topic=' + encodeURIComponent(s.title) + '&context=' + encodeURIComponent(s.snippet || ''))
  }, [router])

  const getScoreBadge = (s: Signal & { relevance_score?: number }) => {
    const score = s.relevance_score || 0
    if (score >= 30) return { text: 'High Impact', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    if (score >= 15) return { text: 'Relevant', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
    return { text: 'Trending', color: '#a1a1aa', bg: 'rgba(255,255,255,0.08)' }
  }

  // Rigorous keyword filter: EVERY word in the topic query must appear somewhere
  // in the signal (title + snippet + source). "AI agents" => must contain both
  // "ai" AND "agents". Matches whole words (so "ai" won't match "rain").
  function matchesTopic(s: Signal, t: Topic | null): boolean {
    if (!t) return true
    const haystack = `${s.title || ''} ${s.snippet || ''} ${s.source_name || ''}`.toLowerCase()
    // Filter on the chip LABEL (the keyword the user typed), not a long seeded query.
    // "AI agents" => every word (ai, agents) must appear in the story.
    const tokens = t.label.toLowerCase().split(/[\s,]+/).filter(Boolean)
    if (tokens.length === 0) return true
    return tokens.every(tok => {
      const safe = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${safe}`, 'i').test(haystack)
    })
  }

  const filteredSignals = signals.filter(s => matchesTopic(s, activeTopic))
  const skeletonCount = isLoading ? Math.max(0, 6 - visibleCount) : 0
  const visibleSignals = filteredSignals.slice(0, activeTopic ? filteredSignals.length : visibleCount)

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Reading Drawer */}
      <ReadingDrawer 
        signal={readingSignal} 
        isOpen={!!readingSignal} 
        onClose={() => setReadingSignal(null)}
        onWrite={handleWrite}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'white', margin: 0 }}>Feed</h1>
          <span style={{ fontSize: 13, color: '#666' }}>
            {isLoading
              ? `Loading ${visibleCount}/${signals.length || '...'}`
              : activeTopic
              ? `${filteredSignals.length} of ${signals.length} match "${activeTopic.label}"`
              : `${signals.length} signals`}
          </span>
        </div>
        <button
          onClick={() => loadFeed(null)}
          disabled={isLoading}
          style={{ 
            fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #333',
            background: 'transparent', color: '#aaa', cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1, transition: 'all 0.15s'
          }}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Topic Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <button onClick={() => selectTopic(null)} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 99, border: '1px solid',
          cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500,
          transition: 'all 0.15s ease',
          background: activeTopic === null ? 'white' : 'transparent',
          color: activeTopic === null ? 'black' : '#a1a1aa',
          borderColor: activeTopic === null ? 'white' : 'rgba(255,255,255,0.15)',
        }}>
          All Topics
        </button>

        {topics.map((t) => {
          const colors = getTopicColor(t.label)
          const isActive = activeTopic?.label === t.label
          return (
            <div key={t.label} onClick={() => selectTopic(t)} 
              onMouseEnter={() => setHoveredChip(t.label)} onMouseLeave={() => setHoveredChip(null)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 6px 6px 14px', borderRadius: 99, border: '1px solid',
                cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500,
                transition: 'all 0.15s ease',
                background: isActive ? colors.bg : (hoveredChip === t.label ? 'rgba(255,255,255,0.05)' : 'transparent'),
                color: isActive ? colors.text : '#a1a1aa',
                borderColor: isActive ? colors.border : (hoveredChip === t.label ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)'),
              }}
            >
              <span>{t.label}</span>
              <button onClick={(e) => deleteTopic(e, t)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: 99, border: 'none',
                background: hoveredChip === t.label ? 'rgba(239,68,68,0.2)' : 'transparent',
                cursor: 'pointer', opacity: hoveredChip === t.label ? 1 : 0, transition: 'all 0.15s',
              }} title="Delete topic">
                <X size={12} color="#ef4444" />
              </button>
            </div>
          )
        })}

        {showAdd ? (
          <input ref={addInputRef} value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTopic(); if (e.key === 'Escape') { setShowAdd(false); setNewLabel('') }}}
            onBlur={() => { if (!newLabel.trim()) setShowAdd(false) }}
            placeholder="Topic..."
            style={{ flexShrink: 0, width: 120, fontSize: 13, padding: '6px 12px', borderRadius: 99, border: '1px solid #555', background: 'transparent', color: 'white', outline: 'none' }}
          />
        ) : (
          <button onClick={() => setShowAdd(true)} style={{
            flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 99, border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: '#666',
            cursor: 'pointer', fontSize: 18, transition: 'all 0.15s',
          }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = '#aaa' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#666' }}>
            +
          </button>
        )}
      </div>

      {/* Signal Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {visibleSignals.map((s, i) => {
          const badge = getScoreBadge(s)
          return (
            <div key={s.url || i} onClick={() => setReadingSignal(s)} style={{
              borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
              background: '#141414', cursor: 'pointer', transition: 'all 0.3s ease',
              display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease',
            }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
              
              {/* Image */}
              <div style={{
                position: 'relative', height: 140,
                background: s.image_url ? '#000' : 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.image_url ? (
                  <img src={s.image_url} alt="" loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                    onError={(e) => {
                      // If the article image 404s, fall back to the source-logo placeholder.
                      const img = e.target as HTMLImageElement
                      img.style.display = 'none'
                      const ph = img.nextElementSibling as HTMLElement | null
                      if (ph) ph.style.display = 'flex'
                    }}
                  />
                ) : null}
                {/* Source-logo placeholder (shown when no image, or image fails) */}
                <div style={{
                  display: s.image_url ? 'none' : 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  position: 'absolute', inset: 0,
                }}>
                  {s.favicon && (
                    <img src={s.favicon.replace('sz=32', 'sz=64')} alt=""
                      style={{ width: 40, height: 40, borderRadius: 8, opacity: 0.85 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <span style={{ fontSize: 12, color: '#777', fontWeight: 500, textAlign: 'center', padding: '0 12px' }}>
                    {s.source_name}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3 title={s.title} style={{
                  fontSize: 14, fontWeight: 500, color: 'white', margin: 0, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{s.title}</h3>
                
                <p title={s.snippet || ''} style={{
                  fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{s.snippet || 'No excerpt available'}</p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>{formatRelativeTime(s.published_date)}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.color}33`,
                  }}>{badge.text}</span>
                  
                  <button onClick={(e) => { e.stopPropagation(); handleWrite(s); }} style={{
                    marginLeft: 'auto', fontSize: 12, padding: '4px 12px', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#aaa', cursor: 'pointer', transition: 'all 0.15s'
                  }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' }}>
                    Write
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        
        {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)}
        
        {!isLoading && signals.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#666' }}>
            <p>No signals found</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Try refreshing</p>
          </div>
        )}

        {!isLoading && signals.length > 0 && activeTopic && filteredSignals.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#666' }}>
            <p>No signals match &ldquo;{activeTopic.label}&rdquo;</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>
              Every word in the keyword must appear in a story. Try a broader keyword or pick All Topics.
            </p>
          </div>
        )}
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
