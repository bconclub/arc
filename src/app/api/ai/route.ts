import { supabaseAdmin } from '@/lib/supabase'
import { callAIStream } from '@/lib/ai-client'
import type { AIModel } from '@/lib/ai-client'

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
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 10, include_images: true })
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

    // ── fetch-signals ──────────────────────────────────────────
    if (action === 'fetch-signals') {
      const { topic } = body as { topic?: string }

      // Topic override: single Tavily search for that query
      if (topic) {
        const signals = await tavilySearch(topic)
        return Response.json({ signals })
      }

      // Default: read all active sources from Supabase
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

    // ── get-topics ─────────────────────────────────────────────
    if (action === 'get-topics') {
      const { data, error } = await supabaseAdmin
        .from('arc_context')
        .select('value')
        .eq('key', 'feed_topics')
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('get-topics error:', error)
      }
      return Response.json({ topics: data?.value || [] })
    }

    // ── save-topic ─────────────────────────────────────────────
    if (action === 'save-topic') {
      const { topics } = body as { topics: { label: string; query: string }[] }
      const { error } = await supabaseAdmin
        .from('arc_context')
        .upsert({ key: 'feed_topics', value: topics, updated_at: new Date().toISOString() })

      if (error) {
        console.error('save-topic error:', error)
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ ok: true })
    }

    // ── write-post ─────────────────────────────────────────────
    if (action === 'write-post') {
      const payload = (body.payload || {}) as {
        topic?: string
        context?: string
        format?: string
        model?: string
      }
      const { topic, context, format = 'LinkedIn', model = 'claude' } = payload

      if (!topic) return Response.json({ error: 'topic required' }, { status: 400 })

      const systemPrompt = `You are an expert social media content writer. Write punchy, engaging ${format} posts that drive real engagement. Be direct, conversational, and avoid corporate fluff. No hashtag spam. Sound like a sharp founder, not a marketer.`
      const userMessage = `Write a ${format} post about: ${topic}${context ? '\n\nContext: ' + context : ''}`

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of callAIStream({
              model: model as AIModel,
              systemPrompt,
              userMessage,
              max_tokens: 800,
            })) {
              controller.enqueue(new TextEncoder().encode(chunk))
            }
          } finally {
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('API error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
