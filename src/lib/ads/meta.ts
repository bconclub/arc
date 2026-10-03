/**
 * Meta Marketing API. SERVER ONLY, never import into a client component.
 *
 * Reads campaign spend and results for the connected ad account. Nothing here
 * writes: ARC reports on ads, it does not manage them, so the token only ever
 * needs `ads_read`.
 */

const API = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 10_000;

export type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  /** Rupees. Meta returns spend as a string, in the account currency. */
  spend: number;
  impressions: number;
  clicks: number;
  /** Click-through rate as a percentage. */
  ctr: number | null;
  /** Cost per click, account currency. */
  cpc: number | null;
  /** The objective's own success metric, e.g. leads or purchases. */
  results: number | null;
  resultLabel: string | null;
  costPerResult: number | null;
};

export type MetaSummary = {
  currency: string;
  /** Numeric account id these figures came from, so multi-account callers can tell them apart. */
  accountId: string;
  accountName: string | null;
  since: string;
  until: string;
  spend: number;
  impressions: number;
  clicks: number;
  campaigns: MetaCampaign[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function call(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      // Meta puts the useful part in error.message; the HTTP status alone is
      // almost always just 400 and says nothing about what to fix.
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Results are objective-dependent: a lead campaign counts leads, a traffic
 * campaign counts link clicks. Meta returns them all in one `actions` array, so
 * the right one has to be picked per objective rather than assumed.
 */
const RESULT_ACTION: Record<string, { type: string; label: string }> = {
  OUTCOME_LEADS: { type: "lead", label: "leads" },
  LEAD_GENERATION: { type: "lead", label: "leads" },
  OUTCOME_SALES: { type: "purchase", label: "purchases" },
  CONVERSIONS: { type: "purchase", label: "purchases" },
  OUTCOME_TRAFFIC: { type: "link_click", label: "link clicks" },
  LINK_CLICKS: { type: "link_click", label: "link clicks" },
  OUTCOME_ENGAGEMENT: { type: "post_engagement", label: "engagements" },
  POST_ENGAGEMENT: { type: "post_engagement", label: "engagements" },
  OUTCOME_AWARENESS: { type: "reach", label: "reach" },
};

type Action = { action_type: string; value: string };

/**
 * Which ad account belongs to which brand.
 *
 * `META_AD_ACCOUNTS` is a JSON map of brand slug to numeric account id, e.g.
 *   {"bcon":"597108084400369","proxe":"912260251376153"}
 *
 * One Meta token covers every account it has `ads_read` on, so this is a routing
 * table, not a credential store. Falling back to the single `META_AD_ACCOUNT_ID`
 * keeps the existing Operations Ads panel working untouched.
 *
 * Note these are Graph API account ids, unrelated to whether Meta has enabled
 * its own Ads MCP on them — that rollout gates the MCP surface only, and ARC
 * reads the Graph API directly.
 */
export function adAccountsByBrand(): Record<string, string> {
  const raw = process.env.META_AD_ACCOUNTS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [brand, id] of Object.entries(parsed)) {
        if (typeof id === "string" && id.trim()) out[brand] = id.trim();
      }
      if (Object.keys(out).length) return out;
    } catch {
      // A malformed map should not take the ads panel down with it. Fall through
      // to the single-account var, which is the pre-existing behaviour.
    }
  }
  const single = process.env.META_AD_ACCOUNT_ID;
  return single ? { global: single } : {};
}

export async function fetchMetaAds(
  datePreset = "last_30d",
  /** Numeric account id. Defaults to META_AD_ACCOUNT_ID for existing callers. */
  accountId?: string,
): Promise<MetaSummary> {
  const token = process.env.META_ACCESS_TOKEN;
  const account = accountId || process.env.META_AD_ACCOUNT_ID;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set.");
  if (!account) throw new Error("No ad account id (set META_AD_ACCOUNTS or META_AD_ACCOUNT_ID).");

  // Tolerate the id being given with or without the act_ prefix.
  const act = account.startsWith("act_") ? account : `act_${account}`;

  const acct = await call(act, { fields: "name,currency" }, token);

  const insights = await call(`${act}/insights`, {
    level: "campaign",
    date_preset: datePreset,
    fields: "campaign_id,campaign_name,objective,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type",
    limit: "100",
  }, token);

  const rows: Record<string, unknown>[] = insights.data ?? [];

  const campaigns: MetaCampaign[] = rows.map((r) => {
    const objective = (r.objective as string) ?? null;
    const want = objective ? RESULT_ACTION[objective] : undefined;
    const actions = (r.actions as Action[]) ?? [];
    const costs = (r.cost_per_action_type as Action[]) ?? [];

    const hit = want ? actions.find((a) => a.action_type === want.type) : undefined;
    const costHit = want ? costs.find((a) => a.action_type === want.type) : undefined;

    return {
      id: String(r.campaign_id ?? ""),
      name: String(r.campaign_name ?? "Unnamed"),
      // Insights carry no status; it is filled in from the campaigns call below.
      status: "",
      objective,
      spend: num(r.spend),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      ctr: r.ctr == null ? null : num(r.ctr),
      cpc: r.cpc == null ? null : num(r.cpc),
      results: hit ? num(hit.value) : null,
      resultLabel: want?.label ?? null,
      costPerResult: costHit ? num(costHit.value) : null,
    };
  });

  // Status lives on the campaign object, not on insights, so it takes a second
  // call. Worth it: "spending" and "paused but spent last week" look identical
  // otherwise, and only one of them needs attention.
  if (campaigns.length) {
    try {
      const meta = await call(`${act}/campaigns`, {
        fields: "id,status,effective_status",
        limit: "200",
      }, token);
      const byId = new Map<string, string>();
      for (const c of (meta.data ?? []) as Record<string, string>[]) {
        byId.set(c.id, c.effective_status ?? c.status ?? "");
      }
      for (const c of campaigns) c.status = byId.get(c.id) ?? "";
    } catch {
      // Statuses are a nicety; spend figures are the point. Carry on without.
    }
  }

  const period = (rows[0] ?? {}) as { date_start?: string; date_stop?: string };

  return {
    currency: String(acct.currency ?? "INR"),
    accountId: act.replace(/^act_/, ""),
    accountName: (acct.name as string) ?? null,
    since: period.date_start ?? "",
    until: period.date_stop ?? "",
    spend: campaigns.reduce((s, c) => s + c.spend, 0),
    impressions: campaigns.reduce((s, c) => s + c.impressions, 0),
    clicks: campaigns.reduce((s, c) => s + c.clicks, 0),
    campaigns: campaigns.sort((a, b) => b.spend - a.spend),
  };
}

// ── Daily series and ad-level detail (investor portal) ──────────

export type MetaDay = {
  day: string;            // YYYY-MM-DD, account timezone
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

function actId(account: string): string {
  return account.startsWith("act_") ? account : `act_${account}`;
}

function leadsOf(actions: Action[] | undefined): number {
  // Lead ads report under "lead"; instant forms sometimes only under the grouped type.
  const hit =
    actions?.find((a) => a.action_type === "lead") ??
    actions?.find((a) => a.action_type === "onsite_conversion.lead_grouped");
  return hit ? num(hit.value) : 0;
}

/**
 * One row per day for the account. A window total cannot answer "what are we
 * spending daily", so this asks Meta for time_increment=1. Days with no
 * delivery are absent from Meta's answer; the caller fills them with zero.
 */
export async function fetchMetaDaily(accountId: string, since: string, until: string): Promise<MetaDay[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set.");
  const res = await call(`${actId(accountId)}/insights`, {
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "spend,impressions,clicks,actions",
    limit: "400",
  }, token);
  return ((res.data ?? []) as Record<string, unknown>[]).map((r) => ({
    day: String(r.date_start ?? ""),
    spend: num(r.spend),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    leads: leadsOf(r.actions as Action[] | undefined),
  }));
}

export type MetaRunningAd = {
  id: string;
  name: string;
  status: string;
  campaign: string | null;
  headline: string | null;
  body: string | null;
  thumbnail: string | null;
  /** last 30 days */
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

/**
 * The ads actually delivering now, with their creative, so "what ads are
 * running" shows the ad itself rather than a campaign name. Spend is the
 * last 30 days per ad.
 */
export async function fetchMetaRunningAds(accountId: string): Promise<MetaRunningAd[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set.");
  const act = actId(accountId);

  const adsRes = await call(`${act}/ads`, {
    fields: "id,name,effective_status,campaign{name},creative{title,body,thumbnail_url,image_url}",
    effective_status: JSON.stringify(["ACTIVE"]),
    limit: "50",
  }, token);

  const ads = ((adsRes.data ?? []) as Record<string, unknown>[]).map((a) => {
    const creative = (a.creative ?? {}) as Record<string, string | undefined>;
    const campaign = (a.campaign ?? {}) as { name?: string };
    return {
      id: String(a.id ?? ""),
      name: String(a.name ?? "Untitled ad"),
      status: String(a.effective_status ?? ""),
      campaign: campaign.name ?? null,
      headline: creative.title ?? null,
      body: creative.body ?? null,
      thumbnail: creative.image_url ?? creative.thumbnail_url ?? null,
      spend: 0, impressions: 0, clicks: 0, leads: 0,
    } as MetaRunningAd;
  });
  if (!ads.length) return ads;

  try {
    const ins = await call(`${act}/insights`, {
      level: "ad",
      date_preset: "last_30d",
      fields: "ad_id,spend,impressions,clicks,actions",
      limit: "200",
    }, token);
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of (ins.data ?? []) as Record<string, unknown>[]) byId.set(String(r.ad_id), r);
    for (const ad of ads) {
      const r = byId.get(ad.id);
      if (!r) continue;
      ad.spend = num(r.spend);
      ad.impressions = num(r.impressions);
      ad.clicks = num(r.clicks);
      ad.leads = leadsOf(r.actions as Action[] | undefined);
    }
  } catch {
    // Creatives without numbers still answer "what is running".
  }
  return ads.sort((a, b) => b.spend - a.spend);
}
