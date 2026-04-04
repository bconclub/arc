'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { Signal } from '@/lib/supabase'

type Topic = { label: string; query: string }

const STORAGE_KEY = 'arc:feed-topics'

const DEFAULT_TOPICS: Topic[] = [
  { label: 'Marketing', query: 'marketing trends India SMB 2026' },
  { label: 'AI Tools', query: 'AI tools business automation 2026' },
]

// Format relative time (e.g., "2h ago", "1d ago")
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
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
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

export default function FeedPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<Topic[]>([])
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Load topics from localStorage on mount
  useEffect(() => {
    setTopics(getStoredTopics())
    loadFeed(null)
  }, [])

  useEffect(() => {
    if (showAdd) addInputRef.current?.focus()
  }, [showAdd])

  async function loadFeed(topic: Topic | null) {
    setLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-signals', topic: topic?.query })
      })
      const data = await res.json()
      const signalsArray = Array.isArray(data?.signals) ? data.signals : []
      setSignals(signalsArray)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  function selectTopic(t: Topic | null) {
    setActiveTopic(t)
    loadFeed(t)
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
      loadFeed(null)
    }
  }

  // Get score badge based on relevance_score
  const getScoreBadge = (s: Signal & { relevance_score?: number }) => {
    const score = s.relevance_score || 0
    if (score >= 30) return { text: 'High Impact', color: '#EF9F27', bg: '#2d1f00' }
    if (score >= 15) return { text: 'Relevant', color: '#1D9E75', bg: '#001f15' }
    return { text: 'Trending', color: '#888780', bg: '#1a1a1a' }
  }

  return (
    <div style={{ padding: '1rem 1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'white' }}>Feed</span>
          <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>Top {signals.length} signals</span>
        </div>
        <button
          onClick={() => selectTopic(activeTopic)}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Topic Chips */}
      <div
        className="scrollbar-hide"
        style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: '1.25rem' }}
      >
        <button
          onClick={() => selectTopic(null)}
          style={{
            flexShrink: 0, fontSize: 12, padding: '4px 12px', borderRadius: 99,
            border: '0.5px solid #333', cursor: 'pointer', whiteSpace: 'nowrap',
            background: activeTopic === null ? 'white' : 'transparent',
            color: activeTopic === null ? 'black' : '#aaa',
          }}
        >
          All Topics
        </button>

        {topics.map((t) => (
          <div
            key={t.label}
            onClick={() => selectTopic(t)}
            onMouseEnter={() => setHoveredTopic(t.label)}
            onMouseLeave={() => setHoveredTopic(null)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 4px 4px 12px',
              borderRadius: 99,
              border: '0.5px solid #333',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeTopic?.label === t.label ? 'white' : (hoveredTopic === t.label ? 'rgba(255,255,255,0.08)' : 'transparent'),
              color: activeTopic?.label === t.label ? 'black' : '#aaa',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{t.label}</span>
            {hoveredTopic === t.label && (
              <button
                onClick={(e) => deleteTopic(e, t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: 99,
                  border: 'none',
                  background: activeTopic?.label === t.label ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  marginLeft: 2,
                }}
                title="Delete topic"
              >
                <X size={10} color={activeTopic?.label === t.label ? 'black' : '#aaa'} />
              </button>
            )}
          </div>
        ))}

        {showAdd ? (
          <input
            ref={addInputRef}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addTopic()
              if (e.key === 'Escape') { setShowAdd(false); setNewLabel('') }
            }}
            onBlur={() => { if (!newLabel.trim()) setShowAdd(false) }}
            placeholder="Topic..."
            style={{
              flexShrink: 0, fontSize: 12, padding: '4px 10px', borderRadius: 99,
              border: '0.5px solid #555', background: 'transparent', color: 'white',
              outline: 'none', width: 100,
            }}
          />
        ) : (
          <button onClick={() => setShowAdd(true)} style={{
            flexShrink: 0, fontSize: 16, lineHeight: 1, padding: '2px 10px', borderRadius: 99,
            border: '0.5px solid #333', cursor: 'pointer',
            background: 'transparent', color: '#555',
          }}>
            +
          </button>
        )}
      </div>

      {/* Skeleton loading */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gridAutoRows: '280px', gap: 16 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid #222', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 120, background: '#1a1a1a', flexShrink: 0 }} />
              <div style={{ flex: 1, padding: 12, background: '#111' }}>
                <div style={{ height: 12, background: '#222', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 10, background: '#1a1a1a', borderRadius: 4, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signal grid */}
      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gridAutoRows: '280px',
          gap: 16,
        }}>
          {Array.isArray(signals) && signals.map((s, i) => {
            const badge = getScoreBadge(s)
            return (
              <div key={s.url || i} style={{
                height: '100%',
                borderRadius: 12, overflow: 'hidden',
                border: '0.5px solid #2a2a2a',
                background: '#111',
                cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
                display: 'flex', flexDirection: 'column',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>

                {/* Image */}
                <div style={{
                  position: 'relative', height: 120, flexShrink: 0,
                  background: s.image_url ? '#000' : '#1a1a1a', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.image_url ? (
                    <img 
                      src={s.image_url} 
                      alt="" 
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : null}
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, overflow: 'hidden',
                  padding: '12px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                  <div>
                    {/* Title */}
                    <p style={{
                      fontSize: 14, fontWeight: 500, color: 'white',
                      margin: '0 0 8px', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {s.title}
                    </p>
                    
                    {/* Excerpt */}
                    <p style={{
                      fontSize: 12, color: '#888',
                      margin: '0 0 12px', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {s.snippet || 'No excerpt available'}
                    </p>
                  </div>
                  
                  {/* Footer: Time + Score + Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#666', flex: 1 }}>
                      {formatRelativeTime(s.published_date)}
                    </span>
                    
                    <span style={{
                      fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
                      background: badge.bg, color: badge.color,
                      border: '0.5px solid ' + badge.color + '44',
                    }}>
                      {badge.text}
                    </span>
                    
                    <button
                      onClick={() => router.push('/dashboard/write?topic=' + encodeURIComponent(s.title) + '&context=' + encodeURIComponent(s.snippet || ''))}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
                    >
                      Write
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
