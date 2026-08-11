'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
      borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)',
      background: 'var(--card-skeleton)', height: 280, display: 'flex', flexDirection: 'column',
    }}>
      <div className="skeleton" style={{ height: 140 }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 16, borderRadius: 4, width: '90%' }} />
        <div className="skeleton" style={{ height: 12, borderRadius: 4, width: '70%' }} />
        <div className="skeleton" style={{ height: 12, borderRadius: 4, width: '50%', marginTop: 'auto' }} />
      </div>
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
  
  // Render into document.body so the fixed-position drawer escapes any
  // transformed ancestor (the page's animate-fade-in wrapper created a
  // containing block that made the drawer 10,000px tall and hid the footer).
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'var(--overlay)',
          backdropFilter: 'blur(4px)', zIndex: 40,
          opacity: isOpen ? 1 : 0, transition: 'opacity 0.3s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 600,
        background: 'var(--drawer-bg)', borderLeft: '1px solid var(--border)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
              background: badge.bg, color: badge.color, border: `1px solid ${badge.color}33`,
            }}>
              {badge.text}
            </span>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>
              {formatRelativeTime(signal.published_date)}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--body)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glow-white)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--body)' }}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px' }}>
          {/* Image */}
          {signal.image_url && (
            <div style={{
              width: '100%', height: 200, borderRadius: 12, overflow: 'hidden',
              marginBottom: 24, background: 'var(--card-skeleton)',
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
            fontSize: 22, fontWeight: 600, color: 'var(--heading)', margin: '0 0 16px',
            lineHeight: 1.4,
          }}>
            {signal.title}
          </h1>

          {/* Source + always-visible read link */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {signal.favicon && (
                <img src={signal.favicon} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />
              )}
              <span style={{ fontSize: 13, color: 'var(--body)' }}>{signal.source_name}</span>
            </div>
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
                color: 'var(--accent-blue)', cursor: 'pointer',
              }}
            >
              Read full article
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Excerpt / Content */}
          <div style={{
            fontSize: 15, color: 'var(--body)', lineHeight: 1.7,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {signal.snippet ? (
              <p>{signal.snippet}</p>
            ) : (
              <p style={{ color: 'var(--faint)', fontStyle: 'italic' }}>
                No preview available. Open the original source to read the full article.
              </p>
            )}
          </div>
        </div>
        
        {/* Footer Actions */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10, flexShrink: 0, background: 'var(--drawer-bg)',
        }}>
          <button
            onClick={() => window.open(signal.url, '_blank')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glow-white)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
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
              background: 'var(--chip-active-bg)', color: 'var(--chip-active-text)',
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
    </>,
    document.body
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

      // Stagger-reveal the first batch for a nice effect, then reveal the rest
      // instantly so the full pool (up to 150) is available to filter without a
      // long animation.
      const STAGGER = 24
      for (let i = 0; i < Math.min(signalsArray.length, STAGGER); i++) {
        if (abortRef.current) break
        await new Promise(resolve => setTimeout(resolve, STREAM_DELAY))
        setVisibleCount(prev => prev + 1)
      }
      if (!abortRef.current) setVisibleCount(signalsArray.length)
    } catch(e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  // Selecting a topic does NOT refetch, it filters the already-loaded signals
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

  // Rigorous keyword filter: EVERY word in the topic must appear as a WHOLE word
  // in the signal (title + snippet + source). "AI marketing" => the story must
  // contain "ai" AND "marketing" as full words. NOT as fragments. This stops
  // "ai" matching "airports" or "marketing" matching only via a partial.
  function matchesTopic(s: Signal, t: Topic | null): boolean {
    if (!t) return true
    const haystack = `${s.title || ''} ${s.snippet || ''} ${s.source_name || ''}`.toLowerCase()
    const tokens = t.label.toLowerCase().split(/[\s,]+/).filter(Boolean)
    if (tokens.length === 0) return true
    return tokens.every(tok => {
      const safe = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // \b on BOTH sides = whole word only. "ai" matches "AI" / "AI." / "(AI)" but not "airports".
      return new RegExp(`\\b${safe}\\b`, 'i').test(haystack)
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
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--heading)', margin: 0 }}>Feed</h1>
          <span style={{ fontSize: 13, color: 'var(--faint)' }}>
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
            fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-strong)',
            background: 'transparent', color: 'var(--text-muted)', cursor: isLoading ? 'not-allowed' : 'pointer',
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
          background: activeTopic === null ? 'var(--chip-active-bg)' : 'transparent',
          color: activeTopic === null ? 'var(--chip-active-text)' : 'var(--text-muted)',
          borderColor: activeTopic === null ? 'var(--chip-active-bg)' : 'var(--chip-border)',
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
                background: isActive ? colors.bg : (hoveredChip === t.label ? 'var(--glow-white)' : 'transparent'),
                color: isActive ? colors.text : 'var(--text-muted)',
                borderColor: isActive ? colors.border : (hoveredChip === t.label ? 'var(--border-strong)' : 'var(--chip-border)'),
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
            style={{ flexShrink: 0, width: 120, fontSize: 13, padding: '6px 12px', borderRadius: 99, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', outline: 'none' }}
          />
        ) : (
          <button onClick={() => setShowAdd(true)} style={{
            flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 99, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--faint)',
            cursor: 'pointer', fontSize: 18, transition: 'all 0.15s',
          }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)' }}>
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
              borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)',
              background: 'var(--card-bg)', cursor: 'pointer', transition: 'all 0.3s ease',
              display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease',
            }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--card-border-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--card-border)' }}>

              {/* Image */}
              <div style={{
                position: 'relative', height: 140,
                background: s.image_url ? 'var(--thumb-bg)' : 'var(--thumb-empty)',
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
                  <span style={{ fontSize: 12, color: 'var(--body)', fontWeight: 500, textAlign: 'center', padding: '0 12px' }}>
                    {s.source_name}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3 title={s.title} style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--heading)', margin: 0, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{s.title}</h3>

                <p title={s.snippet || ''} style={{
                  fontSize: 12, color: 'var(--body)', margin: 0, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{s.snippet || 'No excerpt available'}</p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>{formatRelativeTime(s.published_date)}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.color}33`,
                  }}>{badge.text}</span>

                  <button onClick={(e) => { e.stopPropagation(); handleWrite(s); }} style={{
                    marginLeft: 'auto', fontSize: 12, padding: '4px 12px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s'
                  }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glow-white)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    Write
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        
        {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)}
        
        {!isLoading && signals.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
            <p>No signals found</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Try refreshing</p>
          </div>
        )}

        {!isLoading && signals.length > 0 && activeTopic && filteredSignals.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
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
