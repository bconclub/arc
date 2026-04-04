'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Signal } from '@/lib/supabase'

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
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadFeed() }, [])

  async function loadFeed() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-signals' })
      })
      const data = await res.json()
      setSignals(data.signals || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtered = filter === 'all'
    ? signals
    : signals.filter(s => s.pillar === filter)

  const scoreLabel = (s: Signal) => {
    if (s.trend_score >= 80) return { text: '▲ Hot ' + s.trend_score, color: '#EF9F27', bg: '#2d1f00' }
    if (s.trend_score >= 60) return { text: '↑ Rising ' + s.trend_score, color: '#1D9E75', bg: '#001f15' }
    return { text: '· Steady ' + s.trend_score, color: '#888780', bg: '#1a1a1a' }
  }

  return (
    <div style={{ padding: '1rem 1.5rem' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'white' }}>Feed</span>
          <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>{signals.length} signals</span>
        </div>
        <button onClick={loadFeed} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['all','pain_points','build_journey','marketing_tips','client_results'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 12, padding: '4px 12px', borderRadius: 99,
            border: '0.5px solid #333', cursor: 'pointer',
            background: filter === f ? 'white' : 'transparent',
            color: filter === f ? 'black' : '#aaa'
          }}>
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid #222' }}>
              <div style={{ height: 140, background: '#1a1a1a' }} />
              <div style={{ padding: 12, background: '#111' }}>
                <div style={{ height: 12, background: '#222', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 10, background: '#1a1a1a', borderRadius: 4, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
          alignItems: 'start'
        }}>
          {filtered.map((s, i) => {
            const badge = scoreLabel(s)
            const imgH = 130 + (s.trend_score > 80 ? 40 : s.trend_score > 60 ? 20 : 0)
            const bg = PILLAR_COLORS[s.pillar ?? 'default'] ?? PILLAR_COLORS.default
            return (
              <div key={s.url || i} style={{
                borderRadius: 12, overflow: 'hidden',
                border: '0.5px solid #2a2a2a',
                background: '#111',
                cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>

                <div style={{ position: 'relative', height: imgH, background: bg, display: 'flex', alignItems: 'flex-end', padding: 10 }}>
                  {s.image_url && <img src={s.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />}
                  <span style={{ position: 'relative', fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99, background: badge.bg, color: badge.color, border: '0.5px solid ' + badge.color + '44' }}>
                    {badge.text}
                  </span>
                </div>

                <div style={{ padding: '10px 12px 12px' }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'white', margin: '0 0 5px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#555', margin: '0 0 10px' }}>
                    {s.source_name} {s.published_date && '· ' + s.published_date}
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => router.push('/dashboard/write?topic=' + encodeURIComponent(s.title) + '&context=' + encodeURIComponent(s.snippet || ''))}
                      style={{ flex: 1, fontSize: 11, padding: '6px 0', borderRadius: 8, border: '0.5px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer' }}>
                      Write this
                    </button>
                    <button onClick={() => window.open(s.url, '_blank')}
                      style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '0.5px solid #333', background: 'transparent', color: '#555', cursor: 'pointer' }}>
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
