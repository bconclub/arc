import { supabaseAdmin } from '@/lib/supabase'
import { callAIStream } from '@/lib/ai-client'
import type { AIModel } from '@/lib/ai-client'
import Anthropic from '@anthropic-ai/sdk'
import type { WebSearchResultBlock, WebSearchToolResultBlock } from '@anthropic-ai/sdk/resources/messages'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function tryHostname(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

// ICP relevance scoring
const ICP_KEYWORDS = {
  high: ['solo founder', 'coaching', 'clinic', 'real estate', 'tutoring', 'whatsapp', 'leads', 'india', 'small business', 'smb'],
  medium: ['saas', 'marketing', 'sales', 'automation', 'crm', 'growth', 'startup', 'b2b', 'enterprise']
}

function calculateRelevanceScore(title: string, snippet: string = ''): number {
  const text = (title + ' ' + snippet).toLowerCase()
  let score = 0
  
  // High value keywords (+10)
  ICP_KEYWORDS.high.forEach(kw => {
    if (text.includes(kw)) score += 10
  })
  
  // Medium value keywords (+5)
  ICP_KEYWORDS.medium.forEach(kw => {
    if (text.includes(kw)) score += 5
  })
  
  return score
}

interface SignalInput {
  title: string
  url: string
  snippet: string
  source_name: string
  published_date: string
  image_url?: string
  trend_score: number
  label: string
  source_type?: string
  favicon?: string
  source_url?: string
  pillar?: string
}

interface SignalWithRelevance extends SignalInput {
  relevance_score: number
}

function rankAndLimitSignals(signals: SignalInput[], limit = 20): SignalWithRelevance[] {
  // Add relevance score to each signal
  const scored: SignalWithRelevance[] = signals.map(s => ({
    ...s,
    relevance_score: calculateRelevanceScore(s.title, s.snippet)
  }))
  
  // Sort by relevance score descending, then by trend_score
  scored.sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) {
      return b.relevance_score - a.relevance_score
    }
    return b.trend_score - a.trend_score
  })
  
  // Return top N
  return scored.slice(0, limit)
}

// Extract og:image from URL using Microlink API (free tier: 100 req/day)
async function extractImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.image?.url || data.data?.logo?.url || null
  } catch {
    return null
  }
}

// Batch extract images for signals (with concurrency limit)
async function batchExtractImages(signals: { url: string; image_url?: string }[], concurrency = 5): Promise<void> {
  const queue = signals.filter(s => !s.image_url)
  
  async function processBatch(batch: typeof queue) {
    await Promise.all(batch.map(async (signal) => {
      const image = await extractImage(signal.url)
      if (image) signal.image_url = image
    }))
  }
  
  for (let i = 0; i < queue.length; i += concurrency) {
    await processBatch(queue.slice(i, i + concurrency))
  }
}

// Used for the main feed — included in Anthropic API cost, no separate credits
async function anthropicWebSearch(query: string): Promise<{
  title: string; url: string; snippet: string; source_name: string;
  published_date: string; image_url: string; trend_score: number; label: string;
  source_type: 'search'; favicon: string; source_url: string;
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
      published_date: string; image_url: string; trend_score: number; label: string;
      source_type: 'search'; favicon: string; source_url: string;
    }[] = []

    for (const block of content) {
      const b = block as WebSearchToolResultBlock
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content as WebSearchResultBlock[]) {
          if (r.type === 'web_search_result' && r.url) {
            const hostname = tryHostname(r.url)
            signals.push({
              title: r.title || r.url,
              url: r.url,
              snippet: '',
              source_name: hostname,
              published_date: r.page_age || '',
              image_url: '',
              trend_score: Math.floor(Math.random() * 40 + 60),
              label: 'rising',
              source_type: 'search',
              favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
              source_url: r.url,
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
    const sourceHostname = tryHostname(feedUrl)
    return items.map((r: { title: string; link: string; snippet?: string; pubDate?: string; image?: string }) => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      source_name: sourceHostname,
      published_date: r.pubDate || '',
      image_url: r.image || '',
      trend_score: Math.floor(Math.random() * 40 + 60),
      label: 'rising',
      source_type: 'rss' as const,
      favicon: `https://www.google.com/s2/favicons?domain=${sourceHostname}&sz=32`,
      source_url: feedUrl,
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
        // Extract images for signals without them
        await batchExtractImages(signals, 3)
        // Rank by relevance and limit to top 20
        const ranked = rankAndLimitSignals(signals, 20)
        return Response.json({ signals: ranked })
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
      // Extract images for signals without them
      await batchExtractImages(signals, 3)
      // Rank by relevance and limit to top 20
      const ranked = rankAndLimitSignals(signals, 20)
      return Response.json({ signals: ranked })
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

    // ── generate-brain-prompt ──────────────────────────────────
    if (action === 'generate-brain-prompt') {
      const payload = (body.payload || {}) as { model?: string }
      const { model = 'claude' } = payload

      // Fetch voice context from Supabase
      const { data: contextRows, error: ctxError } = await supabaseAdmin
        .from('arc_context')
        .select('key, value')
        .in('key', ['voice_style', 'about_me', 'sample_posts'])

      if (ctxError) {
        console.error('Failed to fetch context:', ctxError)
        return Response.json({ error: 'Failed to fetch context' }, { status: 500 })
      }

      const ctx = Object.fromEntries((contextRows || []).map((r: { key: string; value: string }) => [r.key, r.value]))
      
      const systemPrompt = `You are a prompt engineering expert. Create a concise system prompt that captures the writer's voice and style. Be specific and actionable. Output only the prompt, no explanations.`
      
      const userMessage = `Create a system prompt for an AI content assistant based on this context:

About: ${ctx.about_me || 'Not set'}
Voice Style: ${ctx.voice_style || 'Not set'}
Sample Posts: ${ctx.sample_posts || 'Not set'}

Generate a concise system prompt (max 200 words) that captures this voice. The prompt should instruct the AI how to write in this style.`

      try {
        const response = await anthropic.messages.create({
          model: model === 'claude' ? 'claude-sonnet-4-5-20251001' : 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        const prompt = Array.isArray(response?.content) 
          ? response.content.map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : '').join('')
          : ''

        return Response.json({ data: { prompt } })
      } catch (e) {
        console.error('Brain prompt generation error:', e)
        return Response.json({ error: 'Failed to generate brain prompt' }, { status: 500 })
      }
    }

    // ── get-saved-signals ──────────────────────────────────────
    if (action === 'get-saved-signals') {
      // Get user from auth header or session (simplified - using anon key for now)
      // In production, verify JWT token
      const { data, error } = await supabaseAdmin
        .from('saved_signals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('get-saved-signals error:', error)
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ signals: data || [] })
    }

    // ── save-signal ────────────────────────────────────────────
    if (action === 'save-signal') {
      const { signal } = body as { 
        signal: {
          title: string;
          url: string;
          source_name: string;
          source_type?: string;
          published_date?: string;
          trend_score?: number;
          snippet?: string;
          favicon?: string;
        }
      }

      if (!signal?.url) {
        return Response.json({ error: 'URL required' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('saved_signals')
        .upsert({
          title: signal.title,
          url: signal.url,
          source: signal.source_name,
          source_type: signal.source_type || 'search',
          published_at: signal.published_date || null,
          score: signal.trend_score || 0,
          excerpt: signal.snippet || '',
          favicon_url: signal.favicon || '',
          created_at: new Date().toISOString(),
        }, { onConflict: 'url' })

      if (error) {
        console.error('save-signal error:', error)
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ ok: true })
    }

    // ── unsave-signal ──────────────────────────────────────────
    if (action === 'unsave-signal') {
      const { url } = body as { url: string }

      if (!url) {
        return Response.json({ error: 'URL required' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('saved_signals')
        .delete()
        .eq('url', url)

      if (error) {
        console.error('unsave-signal error:', error)
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('API error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
