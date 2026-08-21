/**
 * Outreach wing server helpers. SERVER ONLY.
 *
 * Shared by /api/outreach/* so the three AI-touching routes (research, draft,
 * suggest) agree on one model, one Anthropic client, one Tavily caller and one
 * set of copy rules. The copy rules are Z's outbound rules adapted for email:
 * they were written for WhatsApp pings but the spirit is identical, speak only
 * to what the reader can see, one ask, no insider language.
 */
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

export const OUTREACH_MODEL = "claude-opus-5";

// The SDK auto-reads ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL from the env.
// Some runtimes inject those (OAuth bearer + proxy) and the SDK then sends the
// wrong auth → 401. Strip them so only our x-api-key is used. No-op on Vercel.
export function anthropicClient(): Anthropic {
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_CUSTOM_HEADERS;
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: "https://api.anthropic.com",
  });
}

export type TavilyResult = { title: string; url: string; content: string };

/** One paid search credit per call; callers should batch queries deliberately. */
export async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query, max_results: maxResults, search_depth: "basic" }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 800),
    }));
  } catch {
    return [];
  }
}

/** The voice context the drafter writes from (arc_context, seeded on miss). */
export async function voiceContext(): Promise<{ about_me: string; voice_style: string }> {
  const { data } = await supabaseAdmin
    .from("arc_context").select("key, value").in("key", ["voice_style", "about_me"]);
  const ctx = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as string]));
  return { about_me: ctx.about_me ?? "", voice_style: ctx.voice_style ?? "" };
}

/**
 * Z's hard rules for outbound copy, email edition. Mirrors the WhatsApp rules
 * locked 2026-08-16: no insider language (no "founding member", no plan names
 * to a stranger), the reader's context is all that exists, one soft ask.
 */
export const EMAIL_RULES = `
EMAIL RULES (non-negotiable):
- Short. 5-9 lines of body, never more. A busy owner reads it on a phone.
- Open with THEIR business: something true and specific from the research
  (their courses, their clinic, their listings). Never open with "I" or "we".
- No insider language: no "founding member", no plan names, no pricing,
  no feature lists. They have zero context on us; speak only to their leak.
- One soft ask: a reply or a 15-minute call. Never two asks. Never beg.
- Plain text only. No bold, no bullets, no links except goproxe.com once,
  on its own line near the end.
- Lowercase, first person, texting-a-friend register, but complete enough
  that it reads as a person who respects their time.
- NEVER use em dashes. Use a comma, a period, or a line break.
- Subject line: specific and small, names their business or their leak.
  Never clickbait, never "quick question", never title case.
- Sign off as "thanzeel" with "PROXe" on the next line. Nothing else.`;

/** Model output must survive the no-em-dash rule even when the model slips. */
export function scrubDashes(text: string): string {
  return text.replace(/\s*[–—]\s*/g, ". ").replace(/\.\s*\./g, ".");
}

/** Pulls the first {...} out of a model reply that may be fenced or chatty. */
export function parseJsonBlock<T>(text: string): T | null {
  try {
    const m = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? (m[1] || m[0]) : text) as T;
  } catch {
    return null;
  }
}
