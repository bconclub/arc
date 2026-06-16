import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import type { WebSearchResultBlock, WebSearchToolResultBlock } from '@anthropic-ai/sdk/resources/messages'

// The SDK auto-reads ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / ANTHROPIC_CUSTOM_HEADERS
// from the environment. Some runtimes inject those (e.g. an OAuth bearer token + proxy),
// which makes the SDK send the wrong auth → 401 "Invalid bearer token". Strip them so the
// client uses ONLY our real x-api-key against the public API. No-op on Vercel.
delete process.env.ANTHROPIC_AUTH_TOKEN
delete process.env.ANTHROPIC_BASE_URL
delete process.env.ANTHROPIC_CUSTOM_HEADERS
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com',
})

function tryHostname(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
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

interface CachedSignal {
  id: string
  title: string
  url: string
  snippet: string
  source_name: string
  image_url?: string
  published_date: string
  trend_score: number
  label: string
  saved: boolean
  fetched_at?: string
  created_at: string
}

// Calculate trend score based on pubDate recency
// today = 90, yesterday = 70, 2 days = 50, older = 30
function calculateTrendScore(pubDate: string): number {
  const now = new Date()
  const date = new Date(pubDate)
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffHours / 24

  if (diffDays < 1) return 90 // Today
  if (diffDays < 2) return 70 // Yesterday
  if (diffDays < 3) return 50 // 2 days ago
  return 30 // Older
}

// Determine label based on trend score
function getLabelFromScore(score: number): string {
  if (score >= 80) return 'hot'
  if (score >= 60) return 'rising'
  return 'steady'
}

// ICP relevance booster — we're a marketing company focused on business,
// marketing, and AI. Boost stories in those fields so they rank above generic
// finance/hardware/etc. Returns a score delta added to the recency trend score.
const RELEVANCE_KEYWORDS: { terms: string[]; weight: number }[] = [
  { terms: ['marketing', 'brand', 'advertis', 'campaign', 'seo', 'social media', 'content', 'growth', 'lead'], weight: 30 },
  { terms: ['ai', 'artificial intelligence', 'llm', 'gpt', 'agent', 'automation', 'chatbot', 'machine learning'], weight: 25 },
  { terms: ['startup', 'founder', 'saas', 'b2b', 'smb', 'small business', 'entrepreneur', 'product'], weight: 20 },
]
// Topics we actively want to push DOWN (not our focus).
const DEMOTE_KEYWORDS = ['stock', 'shares', 'ipo', 'crypto', 'bitcoin', 'fund raises', 'block deal', 'quarterly results']

function relevanceBoost(title: string, snippet: string): number {
  const text = `${title} ${snippet}`.toLowerCase()
  let boost = 0
  for (const group of RELEVANCE_KEYWORDS) {
    if (group.terms.some(t => text.includes(t))) boost += group.weight
  }
  if (DEMOTE_KEYWORDS.some(t => text.includes(t))) boost -= 20
  return boost
}

// Check if we have valid cached signals (within 2 hours)
async function getCachedSignals(): Promise<CachedSignal[] | null> {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabaseAdmin
      .from('signals')
      .select('*')
      .gte('fetched_at', twoHoursAgo)
      .order('trend_score', { ascending: false })
      .limit(150)

    if (error) {
      console.error('Cache check error:', error)
      return null
    }

    // Only return cache if we have a reasonable number of signals
    if (data && data.length >= 5) {
      console.log(`[Cache] Returning ${data.length} cached signals`)
      return data as CachedSignal[]
    }
    
    return null
  } catch (e) {
    console.error('Cache check failed:', e)
    return null
  }
}

// Cache signals in Supabase
async function cacheSignals(signals: SignalInput[]): Promise<void> {
  try {
    const now = new Date().toISOString()
    
    // Prepare signals for upsert
    const signalsToUpsert = signals.map(signal => ({
      title: signal.title,
      url: signal.url,
      snippet: signal.snippet,
      source_name: signal.source_name,
      image_url: signal.image_url || '',
      published_date: signal.published_date,
      trend_score: signal.trend_score,
      label: signal.label,
      source_type: signal.source_type || 'rss',
      favicon: signal.favicon || '',
      fetched_at: now,
      // Don't overwrite saved status if signal already exists
      saved: false,
    }))

    // Use upsert with onConflict on url
    const { error } = await supabaseAdmin
      .from('signals')
      .upsert(signalsToUpsert, { 
        onConflict: 'url',
        ignoreDuplicates: false 
      })

    if (error) {
      console.error('Cache save error:', error)
    } else {
      console.log(`[Cache] Saved ${signals.length} signals`)
    }
  } catch (e) {
    console.error('Cache save failed:', e)
  }
}

// Used for search chips only — reserved Tavily search for explicit user intent
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
            const trendScore = r.page_age ? calculateTrendScore(r.page_age) : 70
            signals.push({
              title: r.title || r.url,
              url: r.url,
              snippet: '',
              source_name: hostname,
              published_date: r.page_age || '',
              image_url: '',
              trend_score: trendScore,
              label: getLabelFromScore(trendScore),
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

// Fetch RSS feeds in batch using new POST endpoint
async function fetchRSSBatch(feedUrls: string[], baseUrl: string): Promise<SignalInput[]> {
  try {
    const res = await fetch(`${baseUrl}/api/fetch-rss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: feedUrls }),
    })

    if (!res.ok) {
      console.error('RSS batch error:', await res.text())
      return []
    }

    const data = await res.json()
    const items = Array.isArray(data?.data) ? data.data : []

    return items.map((r: { 
      title: string; 
      link: string; 
      snippet?: string; 
      pubDate?: string; 
      image?: string;
      source_name?: string;
    }) => {
      const recency = r.pubDate ? calculateTrendScore(r.pubDate) : 50
      // Blend recency with ICP relevance so business/marketing/AI floats to top.
      const trendScore = recency + relevanceBoost(r.title || '', r.snippet || '')
      return {
        title: r.title || '',
        url: r.link || '',
        snippet: r.snippet || '',
        source_name: r.source_name || 'Unknown',
        published_date: r.pubDate || '',
        image_url: r.image || '',
        trend_score: trendScore,
        label: getLabelFromScore(trendScore),
        source_type: 'rss' as const,
        favicon: `https://www.google.com/s2/favicons?domain=${tryHostname(r.link || '')}&sz=32`,
        source_url: r.link || '',
      }
    })
  } catch (e) {
    console.error('RSS batch fetch error:', e)
    return []
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    // ── fetch-signals ──────────────────────────────────────────
    if (action === 'fetch-signals') {
      const { topic, useSearch } = body as { topic?: string; useSearch?: boolean }
      const baseUrl = new URL(req.url).origin

      // If a specific topic chip is selected with "useSearch" flag, use Tavily
      if (topic && useSearch) {
        const ICP_SUFFIX = 'India SMB business 2026'
        const hasContext = /india|smb|business\s+20/i.test(topic)
        const enriched = hasContext ? topic : `${topic} ${ICP_SUFFIX}`
        const raw = await anthropicWebSearch(enriched)
        const signals = Array.isArray(raw) ? raw : []
        return Response.json({ signals })
      }

      // Check cache first (for non-topic default load)
      if (!topic) {
        const cached = await getCachedSignals()
        if (cached && cached.length > 0) {
          // Transform cached signals to expected format
          const signals = cached.map(s => ({
            title: s.title,
            url: s.url,
            snippet: s.snippet,
            source_name: s.source_name,
            published_date: s.published_date,
            image_url: s.image_url || '',
            trend_score: s.trend_score,
            label: s.label,
            source_type: 'rss' as const,
            favicon: `https://www.google.com/s2/favicons?domain=${tryHostname(s.url)}&sz=32`,
            source_url: s.url,
            saved: s.saved,
          }))
          return Response.json({ signals, cached: true })
        }
      }

      // Load all active sources from Supabase
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

      // Separate RSS and search sources
      const rssSources = sources.filter(s => s.type === 'rss')
      const searchSources = sources.filter(s => s.type === 'tavily_search')

      let signals: SignalInput[] = []

      // Fetch RSS feeds in parallel (zero tokens, zero credits)
      if (rssSources.length > 0) {
        const rssUrls = rssSources.map(s => s.value)
        const rssSignals = await fetchRSSBatch(rssUrls, baseUrl)
        signals = signals.concat(rssSignals)
      }

      // Only fetch search sources if user explicitly selected a search topic chip
      // Default "All Topics" load = RSS only
      if (topic && searchSources.length > 0 && useSearch) {
        const searchResults = await Promise.allSettled(
          searchSources.map(s => anthropicWebSearch(s.value))
        )
        const searchSignals = searchResults.flatMap(r =>
          r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []
        )
        signals = signals.concat(searchSignals)
      }

      // Sort by trend_score descending (recency-based)
      signals.sort((a, b) => b.trend_score - a.trend_score)

      // Keep a large pool so keyword filtering has real depth to search across
      // (18 sources × ~15 items). The UI streams/limits what it shows.
      const limitedSignals = signals.slice(0, 150)

      // Cache results for future requests
      if (!topic && limitedSignals.length > 0) {
        await cacheSignals(limitedSignals)
      }

      return Response.json({ signals: limitedSignals, cached: false })
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
        template?: string
      }
      const { topic, context, format = 'LinkedIn', template } = payload

      if (!topic) return Response.json({ error: 'topic required' }, { status: 400 })

      // Fetch voice context from Supabase
      const { data: contextRows, error: ctxError } = await supabaseAdmin
        .from('arc_context')
        .select('key, value')
        .in('key', ['voice_style', 'about_me', 'brain_system_prompt'])

      if (ctxError) {
        console.error('Failed to fetch context:', ctxError)
      }

      const ctx = Object.fromEntries((contextRows || []).map((r: { key: string; value: string }) => [r.key, r.value]))

      // Fetch template if specified
      let templatePattern = ''
      if (template) {
        const { data: templateData } = await supabaseAdmin
          .from('voice_templates')
          .select('pattern')
          .eq('name', template)
          .single()
        if (templateData) {
          templatePattern = templateData.pattern
        }
      }

      const systemPrompt = `You write ${format} posts AS this founder, in their exact voice. Match the style guide precisely — it is the source of truth, not generic "best practices".

WHO YOU ARE:
${ctx.about_me || ''}

STYLE GUIDE (follow exactly):
${ctx.voice_style || ''}
${ctx.brain_system_prompt ? `\nAdditional instructions: ${ctx.brain_system_prompt}` : ''}
${templatePattern ? `\nFollow this structure: ${templatePattern}` : ''}

NON-NEGOTIABLE RULES:
- Write in first person, lowercase, like texting a friend (not an ad).
- NEVER use em dashes (—). Use periods, commas, or line breaks instead.
- No corporate fluff, no AI buzzwords (synergy, leverage, revolutionize, game-changer).
- Short punchy sentences, one thought per line, heavy line breaks.
- Open with a hook naming a problem people quietly accept.
- Don't oversell. let the story carry it.
- End with a CTA or an open question.`

      const userMessage = `Write a ${format} post about: ${topic}${context ? '\n\nContext: ' + context : ''}`

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                // Enforce the no-em-dash rule on the fly (em/en dash is a single char,
                // never split across deltas).
                const clean = event.delta.text.replace(/\s*[—–]\s*/g, '. ')
                controller.enqueue(new TextEncoder().encode(clean))
              }
            }
          } finally {
            controller.close()
          }
        }
      })

      return new Response(readableStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    // ── generate-brain-prompt ──────────────────────────────────
    if (action === 'generate-brain-prompt') {
      const payload = (body.payload || {}) as { 
        voice_style?: string
        about_me?: string
        templates?: { name: string; pattern: string }[]
      }
      const { voice_style, about_me, templates = [] } = payload

      const systemPrompt = `You are a prompt engineering expert. Create a concise system prompt that captures the writer's voice and style. Be specific and actionable. Output only the prompt, no explanations.`
      
      const templatesText = templates.length > 0 
        ? `\n\nWriting patterns to include:\n${templates.map(t => `- ${t.name}: ${t.pattern}`).join('\n')}`
        : ''

      const userMessage = `Create a system prompt for an AI content assistant based on this context:

About: ${about_me || 'Not set'}
Voice Style: ${voice_style || 'Not set'}
${templatesText}

Generate a concise system prompt (max 200 words) that captures this voice and includes the writing patterns. The prompt should instruct the AI how to write in this style.`

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
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

    // ── analyze-voice ──────────────────────────────────────────
    if (action === 'analyze-voice') {
      const payload = (body.payload || {}) as {
        posts?: { content: string; source: string }[]
        voice_style?: string
      }
      const { posts = [], voice_style } = payload

      if (posts.length === 0) {
        return Response.json({ error: 'No posts provided' }, { status: 400 })
      }

      const postsText = posts.map((p, i) => `Post ${i + 1} (${p.source}):\n${p.content}`).join('\n\n---\n\n')

      const systemPrompt = `You are a writing pattern analyst. Analyze the provided posts and identify 3 distinct writing templates/structures used. Return ONLY valid JSON in this exact format:
[
  {
    "name": "Short descriptive name",
    "pattern": "Brief description of the structure",
    "example": "A 1-2 sentence example in the same style"
  }
]`

      const userMessage = `Analyze these inspiration posts and identify 3 writing templates:

${voice_style ? `Voice style context: ${voice_style}\n\n` : ''}Posts:
${postsText}

Return 3 templates as JSON.`

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        const text = Array.isArray(response?.content) 
          ? response.content.map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : '').join('')
          : ''

        // Parse JSON from response
        let templates: { name: string; pattern: string; example: string }[] = []
        try {
          // Try to extract JSON if wrapped in code blocks
          const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\[([\s\S]*)\]/)
          const jsonStr = jsonMatch ? jsonMatch[0] : text
          templates = JSON.parse(jsonStr)
        } catch (parseError) {
          console.error('Failed to parse templates JSON:', parseError)
          // Fallback: return empty templates
          templates = []
        }

        // Save templates to database
        if (templates.length > 0) {
          const now = new Date().toISOString()
          const templatesToInsert = templates.map(t => ({
            name: t.name,
            pattern: t.pattern,
            example: t.example,
            created_at: now,
          }))

          // Clear old templates first
          await supabaseAdmin.from('voice_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
          
          // Insert new templates
          const { error: insertError } = await supabaseAdmin
            .from('voice_templates')
            .insert(templatesToInsert)

          if (insertError) {
            console.error('Error saving templates:', insertError)
          }
        }

        return Response.json({ data: { templates } })
      } catch (e) {
        console.error('Voice analysis error:', e)
        return Response.json({ error: 'Failed to analyze voice' }, { status: 500 })
      }
    }

    // ── analyze-style ──────────────────────────────────────────
    // Takes a liked post (pasted text OR a screenshot) + the current style guide,
    // and proposes how to ENHANCE the guide. Returns a structured diff for approval.
    if (action === 'analyze-style') {
      const payload = (body.payload || {}) as {
        text?: string
        imageBase64?: string   // data URL or raw base64 of a screenshot
        imageMediaType?: string
        currentGuide?: string
      }
      const { text, imageBase64, imageMediaType, currentGuide = '' } = payload

      if (!text && !imageBase64) {
        return Response.json({ error: 'Provide post text or a screenshot' }, { status: 400 })
      }

      const systemPrompt = `You are a writing-style analyst for a founder's content engine.
You are given ONE post the user liked (as text or a screenshot of a LinkedIn/Twitter/X post) and their CURRENT style guide.

Do TWO things:
1. Detect the post's source platform ("LinkedIn", "Twitter", or "Other") and extract its text + the structural pattern (hook, body shape, formatting, CTA style).
2. Propose how to ENHANCE the existing style guide based on what's good in this post. DO NOT rewrite the whole guide. Propose small, additive changes.

Return ONLY valid JSON, no prose, in EXACTLY this shape:
{
  "source": "LinkedIn" | "Twitter" | "Other",
  "extractedText": "the post's text",
  "patternName": "short name for the structure, e.g. 'Contrarian hook + proof + CTA'",
  "summary": "1-2 sentence read on what makes this post work",
  "changes": [
    { "type": "add" | "modify", "title": "short label", "detail": "the specific line/rule to add to or change in the style guide" }
  ],
  "proposedGuide": "the FULL updated style guide text if every change is accepted"
}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userContent: any[] = []
      if (imageBase64) {
        const raw = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
        const mt = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(imageMediaType || '')
          ? imageMediaType
          : 'image/png'
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: mt, data: raw },
        })
      }
      userContent.push({
        type: 'text',
        text: `CURRENT STYLE GUIDE:\n${currentGuide || '(empty — this is the first inspiration)'}\n\n${text ? `LIKED POST:\n${text}` : 'The liked post is in the attached screenshot.'}\n\nReturn the JSON.`,
      })

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        })
        const out = Array.isArray(response?.content)
          ? response.content.map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text : '')).join('')
          : ''
        let parsed: unknown = null
        try {
          const m = out.match(/```json\n?([\s\S]*?)\n?```/) || out.match(/\{[\s\S]*\}/)
          parsed = JSON.parse(m ? (m[1] || m[0]) : out)
        } catch {
          return Response.json({ error: 'Could not parse analysis', raw: out.slice(0, 400) }, { status: 502 })
        }
        return Response.json({ data: parsed })
      } catch (e) {
        console.error('analyze-style error:', e)
        return Response.json({ error: 'Failed to analyze style' }, { status: 500 })
      }
    }

    // ── save-style-guide ───────────────────────────────────────
    // Persist the approved (merged) style guide into arc_context.voice_style,
    // which is what write-post already reads — so improving Style improves writing.
    if (action === 'save-style-guide') {
      const { guide } = body as { guide?: string }
      if (typeof guide !== 'string') {
        return Response.json({ error: 'guide required' }, { status: 400 })
      }
      const { error } = await supabaseAdmin
        .from('arc_context')
        .upsert({ key: 'voice_style', value: guide, updated_at: new Date().toISOString() })
      if (error) {
        console.error('save-style-guide error:', error)
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ ok: true })
    }

    // ── draft-outreach ─────────────────────────────────────────
    // Drafts a personalized outreach message for a lead, in our voice, for a
    // channel + product. Uses the style guide so DMs sound like the founder.
    if (action === 'draft-outreach') {
      const payload = (body.payload || {}) as {
        lead?: { name?: string; company?: string; role?: string; industry?: string; region?: string; why?: string }
        channel?: string
        product?: { name?: string; pitch?: string }
        kind?: string // "first touch" | "follow up" | "re-engage"
      }
      const { lead, channel = 'whatsapp', product, kind = 'first touch' } = payload
      if (!lead?.name) return Response.json({ error: 'lead required' }, { status: 400 })

      // Pull the founder voice/style guide.
      const { data: ctxRows } = await supabaseAdmin
        .from('arc_context').select('key, value').in('key', ['voice_style', 'about_me'])
      const ctx = Object.fromEntries((ctxRows || []).map((r: { key: string; value: string }) => [r.key, r.value]))

      const channelRules: Record<string, string> = {
        whatsapp: 'WhatsApp: very short, 2-4 lines, no subject, casual, one clear ask. Indian SMB tone.',
        email: 'Cold email: a subject line that names their leak + a tight 4-6 line body. US business tone. End with a soft call ask.',
        linkedin: 'LinkedIn DM: 3-4 lines, value-first, no hard pitch in the first message.',
        instagram: 'Instagram DM: 2-3 lines, warm, casual, reference their content/business.',
      }

      const systemPrompt = `You write outreach messages AS this founder, in their exact voice.

WHO YOU ARE:
${ctx.about_me || ''}

STYLE GUIDE (follow exactly):
${ctx.voice_style || ''}

CHANNEL RULES:
${channelRules[channel] || channelRules.whatsapp}

HARD RULES:
- lowercase, first person, sound human not salesy.
- NEVER use em dashes.
- Lead with a specific result or their exact pain, not a feature list.
- One clear, low-friction ask (reply, quick call). Never beg.
- Personalize to the lead's company + industry + region.
${channel === 'email' ? 'Return the result as: Subject: <line>\\n\\n<body>.' : 'Return just the message text.'}`

      const userMessage = `Write a ${kind} ${channel} message to:
Name: ${lead.name}
Company: ${lead.company} (${lead.role})
Industry: ${lead.industry}, Region: ${lead.region}
Why now: ${lead.why}

Pitching: ${product?.name || 'PROXe'} — ${product?.pitch || ''}`

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })
        let text = Array.isArray(response?.content)
          ? response.content.map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text : '')).join('')
          : ''
        // Hard guarantee the no-em-dash rule (model occasionally slips): replace
        // em/en dashes with a period or comma depending on surrounding spacing.
        text = text.replace(/\s*[—–]\s*/g, '. ').replace(/\.\s*\./g, '.')
        return Response.json({ data: { message: text } })
      } catch (e) {
        console.error('draft-outreach error:', e)
        return Response.json({ error: 'Failed to draft outreach' }, { status: 500 })
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
