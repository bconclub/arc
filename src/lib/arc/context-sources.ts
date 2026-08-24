// The pullers that fill agent_context. SERVER ONLY.
//
// Lives in lib rather than in the route so both the standalone sync cron and the
// morning brief can run it — the brief must never narrate stale numbers, so it
// refreshes first rather than hoping the 6-hourly cron happened to fire.

import { fetchMetaAds, adAccountsByBrand, type MetaSummary } from "@/lib/ads/meta"
import { writeContext, ttl } from "@/lib/arc/agent-context"

export type PullResult = {
  namespace: string
  scope: string
  ok: boolean
  detail: string
}

/** Rupee formatting for the prose summary. Bots and briefs quote this verbatim. */
export function money(n: number, currency: string): string {
  return `${currency} ${Math.round(n).toLocaleString("en-IN")}`
}

/** Totals a brief can diff against yesterday. Derived, never model-generated. */
export type MetaTotals = {
  spend: number
  leads: number
  cpl: number
  impressions: number
  clicks: number
  active_campaigns: number
}

/**
 * Leads across every campaign whose objective actually counts leads. Campaigns
 * with a different objective contribute spend but not leads, which is why the
 * blended CPL is computed here rather than averaged from per-campaign CPLs.
 */
export function metaTotals(s: MetaSummary): MetaTotals {
  const leads = s.campaigns.reduce((n, c) => n + (c.results ?? 0), 0)
  return {
    spend: Math.round(s.spend),
    leads,
    cpl: leads > 0 ? Math.round(s.spend / leads) : 0,
    impressions: s.impressions,
    clicks: s.clicks,
    active_campaigns: s.campaigns.filter((c) => c.status === "ACTIVE" && c.spend > 0).length,
  }
}

/**
 * Meta ad performance as prose. Leads with what someone would actually ask
 * ("how are the ads doing") rather than dumping every campaign field.
 */
export function metaSummaryMarkdown(s: MetaSummary): string {
  const t = metaTotals(s)
  const lines: string[] = []
  lines.push(`Ad account${s.accountName ? ` "${s.accountName}"` : ""} (${s.accountId}), ${s.since} to ${s.until}.`)
  lines.push(
    `Total spend ${money(s.spend, s.currency)} across ${s.campaigns.length} campaign(s), ` +
      `${t.active_campaigns} actively spending. ${t.leads} lead(s)` +
      `${t.cpl ? ` at ${money(t.cpl, s.currency)} each` : ""}. ` +
      `${s.impressions.toLocaleString("en-IN")} impressions, ${s.clicks.toLocaleString("en-IN")} clicks.`,
  )

  const active = s.campaigns.filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 10)
  if (active.length) {
    lines.push("", "Top campaigns by spend:")
    for (const c of active) {
      const results =
        c.results != null && c.resultLabel
          ? `, ${c.results} ${c.resultLabel}${c.costPerResult != null ? ` at ${money(c.costPerResult, s.currency)} each` : ""}`
          : ""
      lines.push(`- ${c.name}${c.status ? ` [${c.status}]` : ""}: ${money(c.spend, s.currency)}${results}`)
    }
  }

  return lines.join("\n")
}

async function pullMetaAds(brand: string, accountId: string): Promise<PullResult> {
  const ns = "meta_ads"
  try {
    const summary = await fetchMetaAds("last_30d", accountId)
    const written = await writeContext({
      namespace: ns,
      scope: brand,
      payload: {
        ...(summary as unknown as Record<string, unknown>),
        totals: metaTotals(summary),
      },
      summary_md: metaSummaryMarkdown(summary),
      source: `context-sync/meta:${accountId}`,
      // Ad numbers move through the day but not by the minute. Six hours keeps
      // the bot honest about freshness without hammering the Graph API.
      expires_at: ttl(360),
    })
    if (!written.ok) return { namespace: ns, scope: brand, ok: false, detail: written.error }
    return {
      namespace: ns,
      scope: brand,
      ok: true,
      detail: `${summary.campaigns.length} campaigns, ${money(summary.spend, summary.currency)} spend`,
    }
  } catch (e) {
    return { namespace: ns, scope: brand, ok: false, detail: e instanceof Error ? e.message : "pull failed" }
  }
}

function metaPullers(): Array<Promise<PullResult>> {
  const unconfigured = (detail: string): Array<Promise<PullResult>> => [
    Promise.resolve({ namespace: "meta_ads", scope: "global", ok: false, detail }),
  ]

  if (!process.env.META_ACCESS_TOKEN) {
    return unconfigured("not configured (META_ACCESS_TOKEN missing)")
  }
  const accounts = Object.entries(adAccountsByBrand())
  if (!accounts.length) {
    return unconfigured("not configured (no META_AD_ACCOUNTS or META_AD_ACCOUNT_ID)")
  }
  return accounts.map(([brand, id]) => pullMetaAds(brand, id))
}

/**
 * Refresh every source. Each puller is independent: one failing records its own
 * error and the rest still write. A half-fresh bundle beats a stale one, and a
 * source failing for two days should be visible rather than absent.
 */
export async function syncAllSources(): Promise<PullResult[]> {
  // Add further sources here as they come online; each writes its own namespace
  // and the bots pick them up with no change.
  return Promise.all([...metaPullers()])
}
