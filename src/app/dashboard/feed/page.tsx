'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Rss, Search } from 'lucide-react'
import type { Signal } from '@/lib/supabase'

type Topic = { label: string; query: string }
type ViewMode = 'all' | 'saved'

const PILLAR_COLORS: Record<string, string> = {
  pain_points:     '#2d1515',
  build_journey:   '#15152d',
  marketing_tips:  '#152d1f',
  client_results:  '#2d2015',
  default:         '#1a1a1a'
}

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

export default function FeedPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>([])
  const [savedSignals, setSavedSignals] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<Topic[]>([])
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFeed(null)
    loadTopics()
    loadSavedSignals()
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

  async function loadSavedSignals() {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-saved-signals' })
      })
      const data = await res.json()
      const savedArray = Array.isArray(data?.signals) ? data.signals : []
      setSavedSignals(new Set(savedArray.map((s: { url: string }) => s.url)))
    } catch(e) { console.error(e) }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function toggleSave(signal: Signal) {
    const isSaved = savedSignals.has(signal.url)
    const action = isSaved ? 'unsave-signal' : 'save-signal'
    
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action, 
          ...(isSaved ? { url: signal.url } : { signal })
        })
      })
      
      if (res.ok) {
        const newSaved = new Set(savedSignals)
        if (isSaved) {
          newSaved.delete(signal.url)
        } else {
          newSaved.add(signal.url)
        }
        setSavedSignals(newSaved)
      }
    } catch(e) { console.error(e) }
  }

  async function loadTopics() {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-topics' })
      })
      const data = await res.json()
      const topicsArray = Array.isArray(data?.topics) ? data.topics : []
      setTopics(topicsArray)
    } catch(e) { console.error(e) }
  }

  async function addTopic() {
    const label = newLabel.trim()
    if (!label) return
    const next = [...topics, { label, query: label }]
    setTopics(next)
    setNewLabel('')
    setShowAdd(false)
    await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-topic', topics: next })
    })
  }

  function selectTopic(t: Topic | null) {
    setActiveTopic(t)
    loadFeed(t)
  }

  const scoreLabel = (s: Signal) => {
    if (s.trend_score >= 80) return { text: '▲ Hot ' + s.trend_score, color: '#EF9F27', bg: '#2d1f00' }
    if (s.trend_score >= 60) return { text: '↑ Rising ' + s.trend_score, color: '#1D9E75', bg: '#001f15' }
    return { text: '· Steady ' + s.trend_score, color: '#888780', bg: '#1a1a1a' }
  }

  return (
    <div style={{ padding: '1rem 1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'white' }}>Feed</span>
          <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>{signals.length} signals</span>
        </div>
        <button
          onClick={() => selectTopic(activeTopic)}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Scrollable topic chips */}
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
          All
        </button>

        {Array.isArray(topics) && topics.map((t, i) => (
          <button key={i} onClick={() => selectTopic(t)} style={{
            flexShrink: 0, fontSize: 12, padding: '4px 12px', borderRadius: 99,
            border: '0.5px solid #333', cursor: 'pointer', whiteSpace: 'nowrap',
            background: activeTopic?.label === t.label ? 'white' : 'transparent',
            color: activeTopic?.label === t.label ? 'black' : '#aaa',
          }}>
            {t.label}
          </button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gridAutoRows: '320px', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid #222', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 160, background: '#1a1a1a', flexShrink: 0 }} />
              <div style={{ flex: 1, padding: 12, background: '#111' }}>
                <div style={{ height: 12, background: '#222', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 10, background: '#1a1a1a', borderRadius: 4, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signal grid — fixed 320px rows, 160px image + 160px content */}
      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gridAutoRows: '320px',
          gap: 12,
        }}>
          {Array.isArray(signals) && signals.map((s, i) => {
            const badge = scoreLabel(s)
            const bg = PILLAR_COLORS[s.pillar ?? 'default'] ?? PILLAR_COLORS.default
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

                {/* Image — 16:9 aspect ratio */}
                <div style={{
                  position: 'relative', height: 135, flexShrink: 0,
                  background: s.image_url ? '#000' : bg, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.image_url ? (
                    <img 
                      src={s.image_url} 
                      alt="" 
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : s.favicon ? (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    }}>
                      <img 
                        src={s.favicon.replace('sz=32', 'sz=64')} 
                        alt="" 
                        style={{ width: 48, height: 48, borderRadius: 8, opacity: 0.5 }}
                      />
                      <span style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.3)',
                        textAlign: 'center', padding: '0 16px',
                      }}>
                        {s.source_name}
                      </span>
                    </div>
                  ) : (
                    <span style={{
                      fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.13)',
                      letterSpacing: '-0.5px', userSelect: 'none',
                      textAlign: 'center', padding: '0 16px', wordBreak: 'break-all',
                    }}>
                      {s.source_name}
                    </span>
                  )}
                  <span style={{
                    position: 'absolute', bottom: 10, left: 10,
                    fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
                    background: badge.bg, color: badge.color,
                    border: '0.5px solid ' + badge.color + '44',
                  }}>
                    {badge.text}
                  </span>
                </div>

                {/* Content — remaining 160px */}
                <div style={{
                  flex: 1, overflow: 'hidden',
                  padding: '10px 12px 12px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                  <div>
                    {/* Top row: Favicon + Domain + Source Badge + Time */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                    }}>
                      {s.favicon && (
                        <img 
                          src={s.favicon} 
                          alt="" 
                          style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      )}
                      <span style={{ fontSize: 11, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.source_name}
                      </span>
                      {/* Source Type Badge */}
                      <span style={{
                        fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 99,
                        background: s.source_type === 'rss' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                        color: s.source_type === 'rss' ? '#f59e0b' : '#3b82f6',
                        border: `0.5px solid ${s.source_type === 'rss' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        {s.source_type === 'rss' ? <Rss size={9} /> : <Search size={9} />}
                        {s.source_type === 'rss' ? 'RSS' : 'Search'}
                      </span>
                      {/* Relative Time */}
                      {s.published_date && (
                        <span style={{ fontSize: 10, color: '#666' }}>
                          {formatRelativeTime(s.published_date)}
                        </span>
                      )}
                    </div>
                    
                    <p style={{
                      fontSize: 13, fontWeight: 500, color: 'white',
                      margin: '0 0 8px', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {s.title}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => router.push('/dashboard/write?topic=' + encodeURIComponent(s.title) + '&context=' + encodeURIComponent(s.snippet || ''))}
                      style={{ flex: 1, fontSize: 11, padding: '6px 0', borderRadius: 8, border: '0.5px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
                    >
                      Write this
                    </button>
                    <button
                      onClick={() => window.open(s.url, '_blank')}
                      style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '0.5px solid #333', background: 'transparent', color: '#555', cursor: 'pointer' }}
                    >
                      ↗
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
