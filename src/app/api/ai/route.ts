import { supabaseAdmin } from '@/lib/supabase'
import { callAIStream } from '@/lib/ai-client'
import type { AIModel } from '@/lib/ai-client'
import Anthropic from '@anthropic-ai/sdk'
import type { WebSearchResultBlock, WebSearchToolResultBlock } from '@anthropic-ai/sdk/resources/messages'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function tryHostname(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

// Used for the main feed — included in Anthropic API cost, no separate credits
async function anthropicWebSearch(query: string): Promise<{
  title: string; url: string; snippet: string; source_name: string;
  published_date: string; image_url: string; trend_score: number; label: string
}[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
      messages: [{ role: 'user', content: `Find recent news and articles about: ${query}` }],
    })

    const content = Array.isArray(response?.content) ? response.content : []
    const signals: {
      title: string; url: string; snippet: string; source_name: string;
      published_date: string; image_url: string; trend_score: number; label: string
    }[] = []

    for (const block of content) {
      const b = block as WebSearchToolResultBlock
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content as WebSearchResultBlock[]) {
          if (r.type === 'web_search_result' && r.url) {
            signals.push({
              title: r.title || r.url,
              url: r.url,
              snippet: '',
              source_name: tryHostname(r.url),
              published_date: r.page_age || '',
              image_url: '',
              trend_score: Math.floor(Math.random() * 40 + 60),
              label: 'rising',
            })
          }
        }
      }
    }

    return Array.isArray(signals) ? signals : []
  } catch (e) {
    console.error('Anthropic web_search error for query:', query, e)
    return []
  }
}

// Reserved for extract-signal (Go deeper) — intentional single-URL extraction
type TavilyResult = { title: string; url: string; content?: string; published_date?: string; images?: string[] }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function tavilyExtract(url: string) {
  const res = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ urls: [url] })
  })
  if (!res.ok) { console.error('Tavily extract error:', await res.text()); return null }
  const data = await res.json()
  const r: TavilyResult = data.results?.[0]
  if (!r) return null
  return { content: r.content || '', title: r.title || '', url: r.url || url }
}

async function rssFetch(feedUrl: string, baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`)
    if (!res.ok) {
      console.error('RSS error for url:', feedUrl, await res.text())
      return []
    }
    const data = await res.json()
    const items = Array.isArray(data?.data) ? data.data : []
    return items.map((r: { title: string; link: string; snippet?: string; pubDate?: string; image?: string }) => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      source_name: tryHostname(feedUrl),
      published_date: r.pubDate || '',
      image_url: r.image || '',
      trend_score: Math.floor(Math.random() * 40 + 60),
      label: 'rising',
    }))
  } catch (e) {
    console.error('RSS fetch error for url:', feedUrl, e)
    return []
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    // ── fetch-signals ──────────────────────────────────────────
    if (action === 'fetch-signals') {
      const { topic } = body as { topic?: string }

      // Topic chip override: enrich with ICP context then search via Anthropic
      if (topic) {
        const ICP_SUFFIX = 'India SMB business 2026'
        const hasContext = /india|smb|business\s+20/i.test(topic)
        const enriched = hasContext ? topic : `${topic} ${ICP_SUFFIX}`
        const raw = await anthropicWebSearch(enriched)
        const signals = Array.isArray(raw) ? raw : []
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
            ? anthropicWebSearch(s.value)   // Anthropic web_search, not Tavily
            : rssFetch(s.value, baseUrl)
        )
      )

      const signals = results.flatMap(r =>
        r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []
      )
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
