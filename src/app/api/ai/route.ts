import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { callAI, callAIStream, type AIModel } from "@/lib/ai-client";
import { getFullContext, buildSystemPrompt, seedDefaultContext } from "@/lib/context";
import type { Source } from "@/types/signals";
import { calculateTrendScore, detectPillar } from "@/types/signals";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_BASE_URL = "https://api.tavily.com";

// Seed default sources if table is empty
async function seedDefaultSources() {
  const { data: existing } = await supabaseAdmin.from("sources").select("id").limit(1);
  
  if (!existing || existing.length === 0) {
    const defaultSources = [
      { name: "Inc42", type: "rss", value: "https://inc42.com/feed/", active: true },
      { name: "YourStory", type: "rss", value: "https://yourstory.com/feed", active: true },
      { name: "Neil Patel", type: "rss", value: "https://neilpatel.com/blog/feed/", active: true },
      { name: "Ben's Bites", type: "rss", value: "https://www.bensbites.com/feed", active: true },
      { name: "Marketing Brew", type: "rss", value: "https://www.marketingbrew.com/feeds/newsletter", active: true },
      { name: "WhatsApp India", type: "tavily_search", value: "WhatsApp business leads India 2026", active: true },
      { name: "Meta Ads India", type: "tavily_search", value: "Meta ads small business India 2026", active: true },
      { name: "AI Sales", type: "tavily_search", value: "AI follow-up sales automation India", active: true },
    ];
    
    await supabaseAdmin.from("sources").insert(defaultSources);
  }
}

// Fetch from Tavily Search
async function fetchTavilySearch(query: string): Promise<Array<{
  title: string;
  url: string;
  snippet: string;
  image?: string;
  publishedDate: string;
  sourceName: string;
}>> {
  try {
    const res = await fetch(`${TAVILY_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 8,
        include_images: true,
        time_range: "week",
      }),
    });
    
    if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
    
    const data = await res.json();
    
    return data.results.map((r: { title: string; url: string; content: string; published_date?: string; image?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 300) || "",
      image: r.image,
      publishedDate: r.published_date || new Date().toISOString(),
      sourceName: "Tavily",
    }));
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}

// Tavily Extract for deep context
async function extractTavilyContent(url: string): Promise<string> {
  const res = await fetch(`${TAVILY_BASE_URL}/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ urls: [url] }),
  });

  if (!res.ok) {
    throw new Error(`Tavily extract failed: ${res.status}`);
  }

  const data = await res.json();
  return data.results?.[0]?.content || data.results?.[0]?.raw_content || "Content extraction failed";
}

// Write post with persistent context and model selection
async function* writePostStream(
  topic: string,
  context: string,
  format: string,
  model: AIModel
) {
  await seedDefaultContext();
  const ctx = await getFullContext();
  const systemPrompt = buildSystemPrompt(ctx);

  const formatGuidelines: Record<string, string> = {
    "LinkedIn": "Longer form storytelling (800-1200 chars). Hook in first line. Line breaks between sentences. End with CTA.",
    "X": "Tight single banger or thread format. Max 280 chars per tweet. If thread, number them 1/ 2/ 3/.",
    "Reel script": "Hook in first 3 seconds. Short sentences for voiceover. Include visual cues in [brackets]. CTA at end.",
    "WhatsApp broadcast": "Conversational, personal tone. Use first person. Keep under 300 chars. Direct ask at end.",
  };

  const fullSystemPrompt = `${systemPrompt}\n\nFormat for this post (${format}):\n${formatGuidelines[format] || formatGuidelines["LinkedIn"]}`;

  const userMessage = `Topic: ${topic}\n\nBackground context:\n${context || "No additional context provided."}\n\nWrite the ${format} now.`;

  yield* callAIStream({
    model,
    systemPrompt: fullSystemPrompt,
    userMessage,
    max_tokens: 1024,
  });
}

// Generate brain prompt from context
async function generateBrainSystemPrompt(model: AIModel): Promise<string> {
  await seedDefaultContext();
  const ctx = await getFullContext();
  
  const prompt = `Create a tight system prompt for an AI content writer.

ABOUT THE FOUNDER:
${ctx.about_me}

VOICE STYLE:
${ctx.voice_style}

SAMPLE POSTS THAT WORKED:
${ctx.sample_posts || "Not provided"}

Generate a concise system prompt (3-5 sentences max) that captures:
1. The exact tone and personality
2. Specific patterns from sample posts
3. What to avoid
4. The CTA style

Return ONLY the system prompt text, no commentary.`;

  return await callAI({
    model,
    systemPrompt: "You are a prompt engineer. Create tight, effective system prompts.",
    userMessage: prompt,
    max_tokens: 500,
  });
}

// Fetch all signals from sources
async function fetchAllSignals(sources: Source[]): Promise<Array<{
  id: string;
  title: string;
  url: string;
  snippet: string;
  source_name: string;
  image_url?: string;
  published_date: string;
  pillar: string;
  trend_score: number;
  label: string;
}>> {
  const activeSources = sources.filter(s => s.active);
  const allSignals: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string;
    source_name: string;
    image_url?: string;
    published_date: string;
    pillar: string;
    trend_score: number;
    label: string;
  }> = [];
  
  for (const source of activeSources) {
    if (source.type === "tavily_search") {
      const results = await fetchTavilySearch(source.value);
      results.forEach((r, i) => {
        const { score, label } = calculateTrendScore(r.title, r.snippet, r.publishedDate);
        const pillar = detectPillar(r.title, r.snippet);
        
        allSignals.push({
          id: `tav-${Date.now()}-${i}`,
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source_name: source.name,
          image_url: r.image,
          published_date: r.publishedDate,
          pillar,
          trend_score: score,
          label,
        });
      });
    }
  }
  
  return allSignals.sort((a, b) => b.trend_score - a.trend_score);
}

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();

    if (action === "fetch-signals") {
      await seedDefaultSources();
      
      const { data: sources, error: sourcesError } = await supabaseAdmin
        .from("sources")
        .select("*")
        .eq("active", true);
      
      if (sourcesError) {
        return Response.json({ error: sourcesError.message }, { status: 500 });
      }

      const signals = await fetchAllSignals(sources || []);
      return Response.json({ data: signals });
    }

    if (action === "extract-and-save") {
      const { url, title, snippet, image_url, source_name, trend_score, label } = payload;
      
      const fullContent = await extractTavilyContent(url);
      
      const { data, error } = await supabaseAdmin
        .from("signals")
        .insert({
          title,
          url,
          snippet,
          source_name,
          image_url,
          published_date: new Date().toISOString(),
          trend_score,
          label,
          saved: true,
          saved_at: new Date().toISOString(),
          notes: fullContent,
        })
        .select()
        .single();
      
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ data: { signal: data, fullContent } });
    }

    if (action === "generate-brain-prompt") {
      const { model = "claude" } = payload;
      const prompt = await generateBrainSystemPrompt(model);
      
      await supabaseAdmin
        .from("arc_context")
        .upsert({ 
          key: "brain_system_prompt", 
          value: prompt, 
          updated_at: new Date().toISOString() 
        });
      
      return Response.json({ data: { prompt } });
    }

    if (action === "write-post") {
      const { topic, context, format, model } = payload;
      if (!topic) {
        return Response.json({ error: "Topic required" }, { status: 400 });
      }

      // Get preferred model from context if not specified
      let useModel: AIModel = model || "claude";
      if (!model) {
        await seedDefaultContext();
        const ctx = await getFullContext();
        useModel = ctx.preferred_model || "claude";
      }

      const stream = writePostStream(topic, context || "", format || "LinkedIn", useModel);

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of stream) {
              controller.enqueue(encoder.encode(chunk));
            }
          } catch (error) {
            controller.error(error);
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Request failed";
    console.error("API error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
