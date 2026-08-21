import { NextRequest, NextResponse } from "next/server";
import { anthropicClient, tavilySearch, parseJsonBlock, scrubDashes, OUTREACH_MODEL } from "@/lib/outreach";
import { recordUsage } from "@/lib/arc/usage";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Suggests candidate targets for a segment + city from live search. Returns
 * UNSAVED candidates; Z accepts the ones worth pursuing and fills in the email
 * (search rarely surfaces a clean address, and guessing one would poison the
 * list). Everything returned must be traceable to a search result, the model
 * is told to skip rather than invent.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const segment: string = body?.segment || "";
  const city: string = body?.city || "Bangalore";
  if (!segment) return NextResponse.json({ error: "segment required" }, { status: 400 });

  const [a, b] = await Promise.all([
    tavilySearch(`best ${segment} in ${city} list`, 6),
    tavilySearch(`${segment} ${city} independent small business instagram whatsapp`, 6),
  ]);
  const results = [...a, ...b];
  if (results.length === 0) {
    return NextResponse.json({ error: "No search results. Check TAVILY_API_KEY." }, { status: 502 });
  }

  const sources = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join("\n\n");

  const anthropic = anthropicClient();
  const response = await anthropic.messages.create({
    model: OUTREACH_MODEL,
    max_tokens: 4000,
    system: `You shortlist small Indian businesses for personal founder outreach.
ICP: independent SMBs (coaching academies, clinics, real estate, tutoring,
studios) that run on WhatsApp/Instagram and lose leads to slow replies.
NOT wanted: national chains, aggregators, franchises, marketplaces.

From the search results, list up to 8 REAL businesses. Only businesses that
appear in the results; never invent names, websites, or emails. If a field is
not in the results, use null. Return ONLY JSON:
{ "candidates": [ { "org": "...", "website": null, "city": "...", "segment": "...",
  "why_them": "one line on why they fit and what suggests a lead leak", "source_url": "..." } ] }`,
    messages: [{ role: "user", content: `Segment: ${segment}\nCity: ${city}\n\nSEARCH RESULTS:\n${sources}` }],
  });
  await recordUsage(OUTREACH_MODEL, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0, "outreach-suggest");

  const text = response.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const parsed = parseJsonBlock<{ candidates: { why_them?: string }[] }>(text);
  if (!parsed?.candidates) {
    return NextResponse.json({ error: "Could not parse candidates", raw: text.slice(0, 300) }, { status: 502 });
  }
  for (const c of parsed.candidates) {
    if (c?.why_them) c.why_them = scrubDashes(c.why_them);
  }
  return NextResponse.json({ candidates: parsed.candidates });
}
