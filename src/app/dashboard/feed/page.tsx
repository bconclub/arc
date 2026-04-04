'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import type { Signal } from '@/lib/supabase'
import { getTopicColor } from '@/lib/topic-colors'

type Topic = { label: string; query: string }

const STORAGE_KEY = 'arc:feed-topics'

const DEFAULT_TOPICS: Topic[] = [
  { label: 'Marketing', query: 'marketing trends India SMB 2026' },
  { label: 'AI Tools', query: 'AI tools business automation 2026' },
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

export default function FeedPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<Topic[]>([])
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [hoveredChip, setHoveredChip] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

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

  const getScoreBadge = (s: Signal & { relevance_score?: number }) => {
    const score = s.relevance_score || 0
    if (score >= 30) return { text: 'High Impact', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    if (score >= 15) return { text: 'Relevant', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
    return { text: 'Trending', color: '#a1a1aa', bg: 'rgba(255,255,255,0.08)' }
  }

  return (
    <div style={{ padding: '16px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'white', margin: 0 }}>Feed</h1>
          <span style={{ fontSize: 13, color: '#666' }}>{signals.length} signals</span>
        </div>
        <button
          onClick={() => selectTopic(activeTopic)}
          disabled={loading}
          style={{ 
            fontSize: 13, 
            padding: '6px 14px', 
            borderRadius: 8, 
            border: '1px solid #333', 
            background: 'transparent', 
            color: '#aaa', 
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            transition: 'all 0.15s'
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Topic Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {/* All Topics Chip */}
        <button
          onClick={() => selectTopic(null)}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 99,
            border: '1px solid',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.15s ease',
            background: activeTopic === null ? 'white' : 'transparent',
            color: activeTopic === null ? 'black' : '#a1a1aa',
            borderColor: activeTopic === null ? 'white' : 'rgba(255,255,255,0.15)',
          }}
        >
          All Topics
        </button>

        {/* Topic Chips */}
        {topics.map((t) => {
          const colors = getTopicColor(t.label)
          const isActive = activeTopic?.label === t.label
          
          return (
            <div
              key={t.label}
              onClick={() => selectTopic(t)}
              onMouseEnter={() => setHoveredChip(t.label)}
              onMouseLeave={() => setHoveredChip(null)}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 6px 6px 14px',
                borderRadius: 99,
                border: '1px solid',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: 13,
                fontWeight: 500,
                transition: 'all 0.15s ease',
                background: isActive ? colors.bg : (hoveredChip === t.label ? 'rgba(255,255,255,0.05)' : 'transparent'),
                color: isActive ? colors.text : '#a1a1aa',
                borderColor: isActive ? colors.border : (hoveredChip === t.label ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)'),
              }}
            >
              <span>{t.label}</span>
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
                  background: hoveredChip === t.label ? 'rgba(239,68,68,0.2)' : 'transparent',
                  cursor: 'pointer',
                  opacity: hoveredChip === t.label ? 1 : 0,
                  transition: 'all 0.15s',
                }}
                title="Delete topic"
              >
                <X size={12} color="#ef4444" />
              </button>
            </div>
          )
        })}

        {/* Add Topic Input */}
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
              flexShrink: 0,
              width: 120,
              fontSize: 13,
              padding: '6px 12px',
              borderRadius: 99,
              border: '1px solid #555',
              background: 'transparent',
              color: 'white',
              outline: 'none',
            }}
          />
        ) : (
          <button 
            onClick={() => setShowAdd(true)}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 99,
              border: '1px dashed rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#666',
              cursor: 'pointer',
              fontSize: 18,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
              e.currentTarget.style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
              e.currentTarget.style.color = '#666'
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: 200,
          color: '#666'
        }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Signal Grid */}
      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {signals.length === 0 && (
            <div style={{ 
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666'
            }}>
              <p>No signals found</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Try a different topic or refresh</p>
            </div>
          )}
          
          {signals.map((s, i) => {
            const badge = getScoreBadge(s)
            return (
              <div 
                key={s.url || i} 
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: '#141414',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }}
              >
                {/* Image */}
                <div style={{
                  position: 'relative',
                  height: 140,
                  background: s.image_url ? '#000' : 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {s.image_url ? (
                    <img 
                      src={s.image_url} 
                      alt="" 
                      loading="lazy"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease'
                      }} 
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : s.favicon ? (
                    <img 
                      src={s.favicon.replace('sz=32', 'sz=64')} 
                      alt="" 
                      style={{ width: 48, height: 48, borderRadius: 8, opacity: 0.3 }}
                    />
                  ) : null}
                </div>

                {/* Content */}
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Title */}
                  <h3 style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'white',
                    margin: 0,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {s.title}
                  </h3>
                  
                  {/* Excerpt */}
                  <p style={{
                    fontSize: 12,
                    color: '#888',
                    margin: 0,
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {s.snippet || 'No excerpt available'}
                  </p>
                  
                  {/* Footer */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10,
                    marginTop: 'auto',
                    paddingTop: 8
                  }}>
                    <span style={{ fontSize: 12, color: '#666' }}>
                      {formatRelativeTime(s.published_date)}
                    </span>
                    
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '3px 10px',
                      borderRadius: 99,
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.color}33`,
                    }}>
                      {badge.text}
                    </span>
                    
                    <button
                      onClick={() => router.push('/dashboard/write?topic=' + encodeURIComponent(s.title) + '&context=' + encodeURIComponent(s.snippet || ''))}
                      style={{ 
                        marginLeft: 'auto',
                        fontSize: 12, 
                        padding: '4px 12px', 
                        borderRadius: 6, 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        background: 'transparent', 
                        color: '#aaa', 
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                        e.currentTarget.style.color = 'white'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#aaa'
                      }}
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
