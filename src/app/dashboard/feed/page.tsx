'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Signal } from '@/lib/supabase'

type Topic = { label: string; query: string }

const PILLAR_COLORS: Record<string, string> = {
  pain_points:     '#2d1515',
  build_journey:   '#15152d',
  marketing_tips:  '#152d1f',
  client_results:  '#2d2015',
  default:         '#1a1a1a'
}

export default function FeedPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<Topic[]>([])
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  // Track whether we have ever loaded data — chip clicks shimmer, first load skeletons
  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    loadFeed(null)
    loadTopics()
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
      setSignals(data.signals || [])
    } catch(e) { console.error(e) }
    finally {
      hasLoadedOnce.current = true
      setLoading(false)
    }
  }

  async function loadTopics() {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-topics' })
      })
      const data = await res.json()
      setTopics(data.topics || [])
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

  // Which cards to render while loading
  const displaySignals = loading && hasLoadedOnce.current ? signals : signals
  const isShimmering = loading && hasLoadedOnce.current
  const isFirstLoad  = loading && !hasLoadedOnce.current

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

        {topics.map((t, i) => (
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

      {/* First-load skeleton grid */}
      {isFirstLoad && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gridAutoRows: '320px', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid #222', display: 'flex', flexDirection: 'column' }}>
              <div className="card-line-shimmer" style={{ height: 160, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: 12, background: '#111', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="card-line-shimmer" style={{ height: 12, width: '90%' }} />
                <div className="card-line-shimmer" style={{ height: 12, width: '70%' }} />
                <div className="card-line-shimmer" style={{ height: 10, width: '40%', marginTop: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signal grid — stays in place during chip re-fetch, shimmer overlaid */}
      {!isFirstLoad && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gridAutoRows: '320px',
          gap: 12,
        }}>
          {displaySignals.map((s, i) => {
            const badge = scoreLabel(s)
            const bg = PILLAR_COLORS[s.pillar ?? 'default'] ?? PILLAR_COLORS.default
            return (
              <div key={s.url || i} style={{
                height: '100%',
                borderRadius: 12, overflow: 'hidden',
                border: '0.5px solid #2a2a2a',
                background: '#111',
                cursor: isShimmering ? 'default' : 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
                display: 'flex', flexDirection: 'column',
              }}
              onMouseEnter={e => { if (!isShimmering) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>

                {/* Image — fixed 160px */}
                <div style={{
                  position: 'relative', height: 160, flexShrink: 0,
                  background: bg, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.image_url
                    ? <img src={s.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                    : <span style={{
                        fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.13)',
                        letterSpacing: '-0.5px', userSelect: 'none',
                        textAlign: 'center', padding: '0 16px', wordBreak: 'break-all',
                      }}>
                        {s.source_name}
                      </span>
                  }
                  <span style={{
                    position: 'absolute', bottom: 10, left: 10,
                    fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
                    background: badge.bg, color: badge.color,
                    border: '0.5px solid ' + badge.color + '44',
                  }}>
                    {badge.text}
                  </span>
                  {/* Shimmer overlay during re-fetch */}
                  {isShimmering && <div className="card-shimmer-overlay" />}
                </div>

                {/* Content — remaining 160px */}
                <div style={{
                  flex: 1, overflow: 'hidden',
                  padding: '10px 12px 12px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                  {isShimmering ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="card-line-shimmer" style={{ height: 12, width: '90%' }} />
                      <div className="card-line-shimmer" style={{ height: 12, width: '70%' }} />
                      <div className="card-line-shimmer" style={{ height: 10, width: '40%', marginTop: 4 }} />
                    </div>
                  ) : (
                    <>
                      <div>
                        <p style={{
                          fontSize: 13, fontWeight: 500, color: 'white',
                          margin: '0 0 5px', lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {s.title}
                        </p>
                        <p style={{ fontSize: 11, color: '#555', margin: 0 }}>
                          {s.source_name}{s.published_date && ' · ' + s.published_date}
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
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
