export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body
    
    if (action === 'fetch-signals') {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
        },
        body: JSON.stringify({
          query: 'WhatsApp business leads India 2026 OR Meta ads SMB OR AI sales automation',
          search_depth: 'basic',
          max_results: 10
        })
      })
      
      if (!res.ok) {
        const err = await res.text()
        console.error('Tavily error:', err)
        return Response.json({ error: 'Tavily failed', detail: err }, { status: 500 })
      }
      
      const data = await res.json()
      const signals = (data.results || []).map((r: {title: string; url: string; content?: string; published_date?: string; images?: string[]}) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.substring(0, 200) || '',
        source_name: new URL(r.url).hostname.replace('www.', ''),
        published_date: r.published_date || '',
        image_url: r.images?.[0] || '',
        trend_score: Math.floor(Math.random() * 40 + 60),
        label: 'rising'
      }))
      
      return Response.json({ signals })
    }
    
    return Response.json({ error: 'Unknown action' }, { status: 400 })
    
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('API error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
