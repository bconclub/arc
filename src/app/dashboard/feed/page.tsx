'use client'

import { useState, useEffect } from 'react'

interface Signal {
  id: string
  title: string
  source_name: string
  url: string
  snippet: string
}

export default function FeedPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFeed() {
      try {
        setLoading(true)
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch-signals' })
        })
        if (!res.ok) throw new Error('API failed: ' + res.status)
        const data = await res.json()
        // API returns { data: [...] } not { signals: [...] }
        setSignals(data.data || [])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        console.error('Feed error:', e)
      } finally {
        setLoading(false)
      }
    }
    loadFeed()
  }, [])

  if (loading) return (
    <div style={{padding: '2rem', color: 'white'}}>
      Loading feed...
    </div>
  )

  if (error) return (
    <div style={{padding: '2rem', color: 'red'}}>
      Error: {error}
    </div>
  )

  return (
    <div style={{padding: '2rem', color: 'white'}}>
      <h1>Feed ({signals.length} signals)</h1>
      {signals.map((s, i) => (
        <div key={i} style={{marginBottom: '1rem', padding: '1rem', border: '1px solid #333'}}>
          <p>{s.title}</p>
          <p style={{fontSize: '12px', opacity: 0.5}}>{s.source_name}</p>
        </div>
      ))}
    </div>
  )
}
