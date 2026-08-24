// The morning brief. SERVER ONLY.
//
// Reads the freshly-synced agent_context rows, diffs them against yesterday's
// brief, and writes today's brief into arc_briefs — the same table and shape the
// /dashboard/proxe wing already renders. The growth team reads it there; nothing
// new to learn, no new surface to maintain.
//
// Deltas are computed in code, never by the model. A model asked to subtract two
// numbers will occasionally get it wrong, and a wrong number in a morning brief
// is worse than no brief. The model only writes the prose around figures it was
// handed.

import { supabaseAdmin } from "@/lib/supabase"
import Anthropic from "@anthropic-ai/sdk"
import { HAIKU } from "@/lib/llm/models"
import { readContext } from "@/lib/arc/agent-context"
import { type MetaTotals } from "@/lib/arc/context-sources"

/**
 * Business day in IST. Vercel Cron fires in UTC, so a naive `new Date()` rolls
 * the date over at 05:30 IST and would file the 7am brief under the wrong day.
 */
export function istDate(offsetDays = 0): string {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000 + offsetDays * 86_400_000)
  return ist.toISOString().slice(0, 10)
}

type BriefRow = { brief_date: string; totals: Record<string, number> }

/** Yesterday's numbers for this brand, or null on the first ever run. */
async function previousTotals(brand: string, today: string): Promise<MetaTotals | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("arc_briefs")
    .select("brief_date, totals")
    .eq("kind", "brief")
    .eq("brand", brand)
    .lt("brief_date", today)
    .order("brief_date", { ascending: false })
    .limit(1)

  const row = (data as BriefRow[] | null)?.[0]
  if (!row?.totals || typeof row.totals.spend !== "number") return null
  return row.totals as unknown as MetaTotals
}

function pct(now: number, before: number): string {
  if (!before) return now ? "new" : "flat"
  const change = ((now - before) / before) * 100
  if (Math.abs(change) < 1) return "flat"
  return `${change > 0 ? "+" : ""}${change.toFixed(0)}%`
}

/**
 * The comparison block handed to the model. Plain lines, already arithmetic-free
 * from the model's point of view.
 */
function deltaBlock(today: MetaTotals, prev: MetaTotals | null): string {
  if (!prev) return "No prior brief to compare against. This is the first run for this brand."
  return [
    `Spend: ${today.spend} vs ${prev.spend} yesterday (${pct(today.spend, prev.spend)})`,
    `Leads: ${today.leads} vs ${prev.leads} (${pct(today.leads, prev.leads)})`,
    `Cost per lead: ${today.cpl} vs ${prev.cpl} (${pct(today.cpl, prev.cpl)})`,
    `Clicks: ${today.clicks} vs ${prev.clicks} (${pct(today.clicks, prev.clicks)})`,
    `Actively spending campaigns: ${today.active_campaigns} vs ${prev.active_campaigns}`,
  ].join("\n")
}

const SYSTEM = `You write the morning ad-performance brief for a growth team in India. They read it at 7am before deciding what to change that day.

Rules:
- Open with the single thing that matters most today. No preamble, no "here is your brief".
- Every figure you cite is given to you. Never compute, estimate, or invent a number.
- Currency is INR. Write it as "INR 12,340".
- Call out the worst cost-per-lead and the best one by name when both exist.
- If nothing meaningful changed, say so in one line rather than padding.
- End with "Watch:" and at most two concrete things to check today.
- 150 words maximum.
- Markdown, but only these: ** for bold, - for bullets. No headings, no tables, no code fences.
- Never use an em dash. Use a comma or a full stop.`

async function narrate(
  client: Anthropic,
  brand: string,
  summaryMd: string,
  deltas: string,
): Promise<string> {
  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 700,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Brand: ${brand}\n\nToday's position (30-day window):\n${summaryMd}\n\nDay-over-day change:\n${deltas}`,
      },
    ],
  })
  const block = response.content.find((b) => b.type === "text")
  return block && block.type === "text" ? block.text.trim() : ""
}

export type BriefResult = { brand: string; ok: boolean; detail: string }

/**
 * Generate and store one brief per brand that has ad context. Brands with no
 * context row are skipped rather than given an empty brief: a brief that says
 * nothing trains the team to stop opening them.
 */
export async function generateMorningBriefs(): Promise<BriefResult[]> {
  const today = istDate()
  const ctx = await readContext({ namespaces: ["meta_ads"] })
  if ("error" in ctx) return [{ brand: "-", ok: false, detail: ctx.error }]

  const usable = ctx.blocks.filter((b) => b.summary_md.trim() && b.scope !== "global")
  if (!usable.length) {
    return [{ brand: "-", ok: false, detail: "no meta_ads context rows to brief on" }]
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return [{ brand: "-", ok: false, detail: "ANTHROPIC_API_KEY missing" }]
  const client = new Anthropic({ apiKey })

  const results: BriefResult[] = []
  for (const block of usable) {
    const brand = block.scope
    try {
      const totals = (block.payload as { totals?: MetaTotals }).totals
      if (!totals) {
        results.push({ brand, ok: false, detail: "context row has no totals" })
        continue
      }

      const prev = await previousTotals(brand, today)
      const body = await narrate(client, brand, block.summary_md, deltaBlock(totals, prev))
      if (!body) {
        results.push({ brand, ok: false, detail: "model returned no text" })
        continue
      }

      const title = `${brand} ads, ${totals.leads} leads at INR ${totals.cpl.toLocaleString("en-IN")}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin as any).from("arc_briefs").upsert(
        {
          kind: "brief",
          brand,
          brief_date: today,
          title,
          body_md: body,
          totals: totals as unknown as Record<string, number>,
          source: "morning-brief",
        },
        { onConflict: "kind,brand,brief_date" },
      )

      if (error) results.push({ brand, ok: false, detail: error.message })
      else results.push({ brand, ok: true, detail: title })
    } catch (e) {
      results.push({ brand, ok: false, detail: e instanceof Error ? e.message : "brief failed" })
    }
  }

  return results
}
