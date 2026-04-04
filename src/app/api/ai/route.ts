import { supabaseAdmin } from '@/lib/supabase'

type TavilyResult = {
  title: string
  url: string
  content?: string
  published_date?: string
  images?: string[]
}

async function tavilySearch(query: string) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
    },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 10 })
  })
  if (!res.ok) {
    console.error('Tavily error for query:', query, await res.text())
    return []
  }
  const data = await res.json()
  return (data.results || []).map((r: TavilyResult) => ({
    title: r.title,
    url: r.url,
    snippet: r.content?.substring(0, 200) || '',
    source_name: new URL(r.url).hostname.replace('www.', ''),
    published_date: r.published_date || '',
    image_url: r.images?.[0] || '',
    trend_score: Math.floor(Math.random() * 40 + 60),
    label: 'rising'
  }))
}

async function rssFetch(feedUrl: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`)
  if (!res.ok) {
    console.error('RSS error for url:', feedUrl, await res.text())
    return []
  }
  const data = await res.json()
  return (data.data || []).map((r: { title: string; link: string; snippet?: string; pubDate?: string; image?: string }) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || '',
    source_name: new URL(feedUrl).hostname.replace('www.', ''),
    published_date: r.pubDate || '',
    image_url: r.image || '',
    trend_score: Math.floor(Math.random() * 40 + 60),
    label: 'rising'
  }))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'fetch-signals') {
      const { data: sources, error } = await supabaseAdmin
        .from('sources')
        .select('*')
        .eq('active', true)

      if (error) {
        console.error('Supabase error:', error)
        return Response.json({ error: 'Failed to load sources', detail: error.message }, { status: 500 })
      }

      if (!sources || sources.length === 0) {
        return Response.json({ signals: [] })
      }

      const baseUrl = new URL(req.url).origin

      const results = await Promise.allSettled(
        sources.map(s =>
          s.type === 'tavily_search'
            ? tavilySearch(s.value)
            : rssFetch(s.value, baseUrl)
        )
      )

      const signals = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])

      return Response.json({ signals })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('API error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
