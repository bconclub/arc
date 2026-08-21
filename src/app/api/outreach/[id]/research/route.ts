import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { anthropicClient, tavilySearch, parseJsonBlock, scrubDashes, OUTREACH_MODEL } from "@/lib/outreach";
import { recordUsage } from "@/lib/arc/usage";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Researches one target: two Tavily searches (their identity + their reviews /
 * presence), then a model pass that condenses everything into a brief the
 * drafter can personalize from. Two searches, not five, because each one is a
 * paid credit and the brief needs a hook, not a dossier.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { data: target, error } = await supabaseAdmin
    .from("outreach_targets").select("*").eq("id", id).single();
  if (error || !target) return NextResponse.json({ error: "target not found" }, { status: 404 });

  const who = [target.org || target.name, target.city].filter(Boolean).join(" ");
  const [identity, presence] = await Promise.all([
    tavilySearch(`${who} ${target.segment ?? ""}`.trim(), 5),
    tavilySearch(`${who} reviews google maps justdial`, 4),
  ]);
  const results = [...identity, ...presence];
  if (results.length === 0 && !target.website) {
    return NextResponse.json({ error: "No research results found. Check TAVILY_API_KEY or add a website." }, { status: 502 });
  }

  const sources = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");

  const anthropic = anthropicClient();
  const response = await anthropic.messages.create({
    model: OUTREACH_MODEL,
    max_tokens: 2500,
    system: `You research small Indian businesses for founder-to-founder outreach.
From the search results, write a research brief about the target. Only state
what the sources support; when the results are about a different business with
a similar name, say so instead of blending them. Return ONLY JSON:
{
  "brief": "5-10 lines: what they do, size signals, how they get leads today (ads? walk-ins? Instagram?), anything time-sensitive",
  "hook": "the single most specific, personal detail an opening line could use",
  "leak_guess": "best guess at where they lose leads (slow WhatsApp replies, no follow-up, missed calls...), phrased as a guess",
  "confidence": "high" | "medium" | "low"
}`,
    messages: [{
      role: "user",
      content: `TARGET:\nName: ${target.name}\nOrg: ${target.org ?? ""}\nSegment: ${target.segment ?? ""}\nCity: ${target.city ?? ""}\nWebsite: ${target.website ?? ""}\nWhy them (our note): ${target.why_them ?? ""}\n\nSEARCH RESULTS:\n${sources || "(none)"}`,
    }],
  });
  await recordUsage(OUTREACH_MODEL, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0, "outreach-research");

  const text = response.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const parsed = parseJsonBlock<{ brief: string; hook: string; leak_guess: string; confidence: string }>(text);
  if (!parsed?.brief) {
    return NextResponse.json({ error: "Could not parse research", raw: text.slice(0, 300) }, { status: 502 });
  }

  const research = scrubDashes([
    parsed.brief.trim(),
    ``,
    `HOOK: ${parsed.hook}`,
    `LEAK GUESS: ${parsed.leak_guess}`,
    `CONFIDENCE: ${parsed.confidence}`,
  ].join("\n"));

  const patch: Record<string, unknown> = { research };
  if (target.status === "identified") patch.status = "researched";
  const { data: updated, error: upErr } = await supabaseAdmin
    .from("outreach_targets").update(patch).eq("id", id).select().single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json(updated);
}
