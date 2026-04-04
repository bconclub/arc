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
  const [mounted, setMounted] = useState(false)
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track mount
  useEffect(() => {
    console.log('FeedPage MOUNTED')
    setMounted(true)
  }, [])

  // Fetch data
  useEffect(() => {
    if (!mounted) return
    
    async function loadFeed() {
      try {
        console.log('Fetching feed...')
        setLoading(true)
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch-signals' })
        })
        console.log('Response status:', res.status)
        if (!res.ok) throw new Error('API failed: ' + res.status)
        const data = await res.json()
        console.log('Signals received:', data.signals?.length)
        setSignals(data.signals || [])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('Feed error:', msg)
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    loadFeed()
  }, [mounted])

  // Always show something immediately
  if (!mounted) {
    return <div style={{padding: '2rem', color: 'yellow'}}>Waiting for hydration...</div>
  }

  if (loading) return (
    <div style={{padding: '2rem', color: 'white'}}>
      <h2>Feed Loading...</h2>
      <p>Mounted: {mounted ? 'yes' : 'no'}</p>
    </div>
  )

  if (error) return (
    <div style={{padding: '2rem', color: 'red'}}>
      <h2>Feed Error</h2>
      <p>{error}</p>
    </div>
  )

  return (
    <div style={{padding: '2rem', color: 'white'}}>
      <h1>Feed ({signals.length} signals)</h1>
      {signals.length === 0 && <p>No signals found. Check console.</p>}
      {signals.map((s, i) => (
        <div key={i} style={{marginBottom: '1rem', padding: '1rem', border: '1px solid #333'}}>
          <p>{s.title || 'No title'}</p>
          <p style={{fontSize: '12px', opacity: 0.5}}>{s.source_name || 'No source'}</p>
        </div>
      ))}
    </div>
  )
}
