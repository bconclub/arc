/**
 * Everything an investor sees, assembled server-side. SERVER ONLY.
 *
 * Scope is PROXe and nothing else: no client names from BCON, no receivables,
 * no other brand's ads. Each section degrades on its own — a dead Meta token
 * blanks the ads card, it does not take the page down — and says why, so an
 * empty card never reads as "zero".
 */
import { supabaseAdmin } from "@/lib/supabase";
import { adAccountsByBrand, fetchMetaDaily, fetchMetaRunningAds, type MetaRunningAd } from "@/lib/ads/meta";
import { isTestTarget } from "@/lib/outreach-workflow";
import {
  fetchProxeLeads, fetchProxeSales, fetchProxeTraction, syncProxeDemos,
  type ProxeLeads, type ProxeSales, type ProxeTraction,
} from "./proxe-sync";

export const PRODUCT = "proxe";

/** Which department a post comes from when the post does not say. */
const DEPT_BY_KIND: Record<string, string> = {
  ads: "Marketing", milestone: "Sales", metric: "Sales", product: "Engineering",
  hiring: "Operations", risk: "Operations", note: "Operations",
};

export type Viewer =
  | { role: "owner" }
  | {
      role: "investor";
      investor: {
        id: string;
        name: string;
        committed_amount: number | null;
        received_amount: number | null;
        equity_pct: number | null;
        round: string | null;
        currency: string;
        invested_on: string | null;
      };
    };

type Section<T> = { ok: true; data: T } | { ok: false; reason: string };

export type DaySpend = { day: string; ads: number; other: number; leads: number };

export type FeedItem = {
  id: string;
  at: string;
  type: "post" | "money" | "demo";
  kind: string;
  stage: "plan" | "executing" | "done" | null;
  title: string;
  body: string | null;
  amount: number | null;
  pinned: boolean;
  /** which part of the company is behind it */
  department: string;
  /** structured detail an ads launch carries */
  detail: { daily_budget?: number | null; targeting?: string | null } | null;
};

export type InvestorOverview = {
  generatedAt: string;
  range: { days: number; since: string; until: string };
  viewer: { role: "owner" | "investor"; name: string };
  money: {
    committed: number | null;
    investedOn: string | null;
    /** everything spent on PROXe since the money landed: ads + ledger */
    deployed: number;
    deployedAds: number;
    deployedOther: number;
    runwayLeft: number | null;
    /** average daily burn over the selected window */
    dailyBurn: number;
  };
  spend: Section<{
    total: number;
    ads: number;
    other: number;
    daily: DaySpend[];
    byCategory: { category: string; amount: number }[];
    ledger: { id: string; spent_on: string; category: string; vendor: string | null; description: string | null; amount: number; approved_by?: string | null; department?: string | null }[];
    byDepartment: { department: string; amount: number }[];
    /** first day money went out; the chart and burn start here */
    since: string;
    burnDays: number;
  }>;
  /** cash put into the ad account vs what Meta has drawn from it */
  adWallet: {
    funded: number;
    spent: number;
    balance: number;
    dailyBudget: number | null;
    daysLeft: number | null;
    firstTopup: string;
    metaConnected: boolean;
    /** true when spent is budget x days since launch, not Meta's figure */
    estimated: boolean;
  } | null;
  ads: Section<{
    running: MetaRunningAd[];
    spend30: number;
    leads30: number;
    cpl30: number | null;
    impressions30: number;
    clicks30: number;
  }>;
  demos: Section<{
    inRange: number;
    done: number;
    noShow: number;
    upcoming: { id: string; company: string; scheduled_at: string }[];
    recent: { id: string; company: string; scheduled_at: string; status: string; outcome: string | null }[];
    weekly: { week: string; count: number }[];
  }>;
  pipeline: Section<{
    stages: { stage: string; count: number }[];
    callsInRange: number;
    connectedInRange: number;
    interestedInRange: number;
  }>;
  product: Section<{
    stage: { title: string; status: string; stand: string | null }[];
    shipped: { repo: string; message: string; date: string }[];
    commitsInRange: number;
  }>;
  updates: { id: string; title: string; body_md: string; kind: string; published_at: string }[];
  /** live product activity from the PROXe database; null when not connected */
  traction: ProxeTraction | null;
  leads: ProxeLeads | null;
  sales: ProxeSales | null;
  /** everything that happened, newest first: posts, money moved, demos */
  feed: FeedItem[];
  /** this investor's slice; for the owner preview, the whole round */
  stake: {
    promised: number | null;
    received: number | null;
    /** owner preview only; null for an investor, who never sees others' money */
    roundPromised: number | null;
    roundReceived: number | null;
    /** promised / round promised */
    shareOfRound: number | null;
    equityPct: number | null;
    /** deployed x shareOfRound */
    yourDeployed: number | null;
    /** deployed / round received (or promised when nothing marked received) */
    roundDeployedPct: number | null;
    investors: number | null;
    round: string | null;
    /** post-money implied by equity for the full promise */
    valuation: number | null;
    /** equity_pct x received / promised */
    equityEarned: number | null;
    /** equity the company has issued so far, all investors combined */
    dilutedSoFar: number | null;
  };
};

const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const iso = (d: Date) => d.toISOString().slice(0, 10);

function missingTable(msg: string | undefined): boolean {
  return Boolean(msg && /schema cache|does not exist|Could not find the table/i.test(msg));
}

/** Monday of the week, for weekly buckets. */
function weekOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return iso(d);
}

/**
 * Pull Meta's daily rows for the window and persist them, so history outlives
 * a lapsed token. Reads back from the table either way: the stored series is
 * the one the chart draws.
 */
async function syncAdSpend(since: string, until: string): Promise<{ synced: boolean; reason?: string }> {
  const account = adAccountsByBrand()[PRODUCT];
  if (!account) return { synced: false, reason: "No PROXe ad account in META_AD_ACCOUNTS." };
  try {
    const days = await fetchMetaDaily(account, since, until);
    if (days.length) {
      await supabaseAdmin.from("ad_spend_daily").upsert(
        days.map((d) => ({
          product: PRODUCT,
          platform: "meta",
          day: d.day,
          account_id: account,
          spend: d.spend,
          impressions: d.impressions,
          clicks: d.clicks,
          leads: d.leads,
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "product,platform,day" },
      );
    }
    return { synced: true };
  } catch (e) {
    return { synced: false, reason: e instanceof Error ? e.message : "Meta did not answer." };
  }
}

async function githubCommits(repos: string[], since: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !repos.length) return null;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "arc-investor",
  };
  const lists = await Promise.all(
    repos.slice(0, 5).map(async (repo) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/commits?since=${since}T00:00:00Z&per_page=100`,
          { headers, cache: "no-store" },
        );
        if (!res.ok) return [];
        const rows = (await res.json()) as { commit?: { message?: string; author?: { date?: string } } }[];
        return rows.map((r) => ({
          repo: repo.split("/")[1] ?? repo,
          message: (r.commit?.message ?? "").split("\n")[0],
          date: r.commit?.author?.date ?? "",
        }));
      } catch {
        return [];
      }
    }),
  );
  return lists.flat().filter((c) => c.message && !/^merge /i.test(c.message))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Posts this viewer may see: everything published for the owner; for an
 * investor, broadcast posts plus the ones addressed to them alone. Before the
 * investor_id column exists no addressed post can exist, so the unfiltered
 * fallback cannot leak one.
 */
async function loadUpdates(viewer: Viewer) {
  const cols = "id,title,body_md,kind,published_at,stage,payload,pinned";
  const base = () => supabaseAdmin.from("investor_updates").select(cols)
    .eq("published", true).order("published_at", { ascending: false }).limit(30);
  if (viewer.role === "owner") return base();
  const scoped = await base().or(`investor_id.is.null,investor_id.eq.${viewer.investor.id}`);
  if (scoped.error && /investor_id/.test(scoped.error.message)) return base();
  return scoped;
}

export async function buildInvestorOverview(viewer: Viewer, days: number): Promise<InvestorOverview> {
  const until = new Date();
  const sinceDate = new Date(until);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (days - 1));
  const since = iso(sinceDate);
  const untilStr = iso(until);

  // ── the money this view is accountable for ──
  // The whole round is loaded either way: an investor's share is their
  // promise over everyone's.
  const { data: roundRows } = await supabaseAdmin
    .from("investors").select("committed_amount,received_amount,invested_on,round,equity_pct").eq("active", true);
  const round = (roundRows ?? []) as { committed_amount: number | null; received_amount: number | null; invested_on: string | null; round: string | null; equity_pct: number | null }[];
  const dilutedSoFar = round.some((r) => r.equity_pct != null)
    ? round.reduce((s, r) => {
        const c = Number(r.committed_amount) || 0;
        const e = Number(r.equity_pct) || 0;
        return s + (c ? e * ((Number(r.received_amount) || 0) / c) : 0);
      }, 0)
    : null;
  const roundPromised = round.reduce((s, r) => s + (Number(r.committed_amount) || 0), 0);
  const roundReceived = round.reduce((s, r) => s + (Number(r.received_amount) || 0), 0);
  const roundStart = round.map((r) => r.invested_on).filter(Boolean).sort()[0] ?? null;

  let committed: number | null = null;
  let received: number | null = null;
  let equityPct: number | null = null;
  let roundName: string | null = round.map((r) => r.round).find(Boolean) ?? null;
  let investedOn: string | null = null;
  let viewerName = "Owner preview";
  if (viewer.role === "investor") {
    committed = viewer.investor.committed_amount;
    received = viewer.investor.received_amount;
    equityPct = viewer.investor.equity_pct;
    roundName = viewer.investor.round;
    investedOn = viewer.investor.invested_on;
    viewerName = viewer.investor.name;
  } else {
    committed = roundPromised || null;
    received = roundReceived || null;
    investedOn = roundStart;
  }

  // Sync ads for whichever window is wider: the view, or since the money landed.
  const syncFrom = investedOn && investedOn < since ? investedOn : since;
  // Meta caps history at 37 months; anything older simply returns empty.
  const sync = await syncAdSpend(syncFrom, untilStr);

  // Pull demo bookings from the PROXe product first, so the demo numbers are
  // the product's own record. A failed sync leaves the last mirror in place.
  const [, traction, leads, sales] = await Promise.all([
    syncProxeDemos(),
    fetchProxeTraction(days).catch(() => null),
    fetchProxeLeads(days).catch(() => null),
    fetchProxeSales().catch(() => null),
  ]);

  const [adRowsRes, expRes, demoRes, targetsRes, activityRes, updatesRes, gtmRes, brandRes] = await Promise.all([
    supabaseAdmin.from("ad_spend_daily").select("day,spend,leads,impressions,clicks")
      .eq("product", PRODUCT).gte("day", syncFrom).lte("day", untilStr),
    supabaseAdmin.from("expenses").select("*")
      .eq("product", PRODUCT).order("spent_on", { ascending: false }),
    supabaseAdmin.from("demos").select("id,company,scheduled_at,status,outcome")
      .eq("product", PRODUCT).order("scheduled_at", { ascending: false }),
    supabaseAdmin.from("outreach_targets").select("name,source,segment,phone,status,kind").eq("kind", "business"),
    supabaseAdmin.from("outreach_activity").select("channel,outcome,occurred_at")
      .eq("channel", "call").gte("occurred_at", `${since}T00:00:00Z`),
    loadUpdates(viewer),
    supabaseAdmin.from("gtm_areas").select("title,status,stand,ord").order("ord"),
    supabaseAdmin.from("brands").select("name,github_repos"),
  ]);

  // ── spend ──
  // Spend is money out of the bank, from the ledger, since the first rupee
  // went out (or since this investor's money landed). An ad top-up counts the
  // day the cash moves into Meta; Meta's own daily delivery is shown on the
  // ads card and never added on top, so no rupee is counted twice.
  const adRows = (adRowsRes.data ?? []) as { day: string; spend: number; leads: number; impressions: number; clicks: number }[];
  const allExpenses = (expRes.data ?? []) as { id: string; spent_on: string; category: string; vendor: string | null; description: string | null; amount: number; daily_budget: number | null; approved_by?: string | null; department?: string | null }[];
  const topups = allExpenses.filter((e) => e.category === "ad_topup");

  const counted = allExpenses.filter((e) => !investedOn || e.spent_on >= investedOn);
  const firstSpend = counted.map((e) => e.spent_on).sort()[0] ?? untilStr;
  const byDay = new Map<string, { ads: number; other: number }>();
  for (const e of counted) {
    const cur = byDay.get(e.spent_on) ?? { ads: 0, other: 0 };
    if (e.category === "ad_topup") cur.ads += Number(e.amount); else cur.other += Number(e.amount);
    byDay.set(e.spent_on, cur);
  }
  const daily: DaySpend[] = [];
  for (let d = new Date(`${firstSpend}T00:00:00Z`); iso(d) <= untilStr; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = iso(d);
    const v = byDay.get(key);
    daily.push({ day: key, ads: v?.ads ?? 0, other: v?.other ?? 0, leads: 0 });
  }
  const deployedAds = counted.filter((e) => e.category === "ad_topup").reduce((s, e) => s + Number(e.amount), 0);
  const deployedOther = counted.filter((e) => e.category !== "ad_topup").reduce((s, e) => s + Number(e.amount), 0);
  const deployed = deployedAds + deployedOther;
  // Averaged over the days since spending began, today included: on day one
  // the burn is everything spent today, and it settles as days pass.
  const burnDays = Math.max(1, Math.round((Date.parse(`${untilStr}T00:00:00Z`) - Date.parse(`${firstSpend}T00:00:00Z`)) / 864e5) + 1);
  const dailyBurn = deployed / burnDays;

  const cat = new Map<string, number>();
  for (const e of counted) cat.set(e.category, (cat.get(e.category) ?? 0) + Number(e.amount));

  const spend: InvestorOverview["spend"] = expRes.error && missingTable(expRes.error.message)
    ? fail("Spend ledger not set up yet.")
    : {
        ok: true,
        data: {
          total: deployed,
          ads: deployedAds,
          other: deployedOther,
          daily,
          byCategory: Array.from(cat, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
          ledger: [...counted].sort((a, b) => b.spent_on.localeCompare(a.spent_on)).slice(0, 50)
            .map(({ id, spent_on, category, vendor, description, amount, approved_by, department }) => ({ id, spent_on, category, vendor, description, amount, approved_by: approved_by ?? null, department: department ?? null })),
          byDepartment: (() => {
            const m = new Map<string, number>();
            for (const e of counted) m.set(e.department || "Unassigned", (m.get(e.department || "Unassigned") ?? 0) + Number(e.amount));
            return Array.from(m, ([department, amount]) => ({ department, amount })).sort((a, b) => b.amount - a.amount);
          })(),
          since: firstSpend,
          burnDays,
        },
      };

  // ── ads ──
  let ads: InvestorOverview["ads"];
  const account = adAccountsByBrand()[PRODUCT];
  if (!account) {
    ads = fail("PROXe ad account is not connected yet.");
  } else {
    try {
      const running = await fetchMetaRunningAds(account);
      const last30 = adRows.filter((r) => r.day >= iso(new Date(Date.now() - 29 * 864e5)));
      const spend30 = last30.reduce((s, r) => s + Number(r.spend), 0);
      const leads30 = last30.reduce((s, r) => s + Number(r.leads), 0);
      ads = {
        ok: true,
        data: {
          running,
          spend30,
          leads30,
          cpl30: leads30 ? spend30 / leads30 : null,
          impressions30: last30.reduce((s, r) => s + Number(r.impressions), 0),
          clicks30: last30.reduce((s, r) => s + Number(r.clicks), 0),
        },
      };
    } catch (e) {
      // The raw cause (env var names, Graph API errors) is for the owner's logs,
      // not an investor's screen.
      console.error("[investor] ads unavailable:", sync.reason ?? (e instanceof Error ? e.message : e));
      ads = fail("Live ad numbers are being connected. The ad wallet above is current.");
    }
  }

  // ── demos ──
  let demos: InvestorOverview["demos"];
  if (demoRes.error) {
    demos = fail(missingTable(demoRes.error.message) ? "Demo tracking not set up yet." : demoRes.error.message);
  } else {
    const all = (demoRes.data ?? []) as { id: string; company: string; scheduled_at: string; status: string; outcome: string | null }[];
    const nowIso = new Date().toISOString();
    const inRange = all.filter((d) => d.scheduled_at.slice(0, 10) >= since && d.scheduled_at <= nowIso);
    const weeks = new Map<string, number>();
    for (const d of all) {
      if (d.status === "cancelled") continue;
      const w = weekOf(d.scheduled_at);
      weeks.set(w, (weeks.get(w) ?? 0) + 1);
    }
    demos = {
      ok: true,
      data: {
        inRange: inRange.filter((d) => d.status !== "cancelled").length,
        done: inRange.filter((d) => d.status === "done").length,
        noShow: inRange.filter((d) => d.status === "no_show").length,
        upcoming: all.filter((d) => d.scheduled_at > nowIso && d.status === "scheduled")
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).slice(0, 8)
          .map(({ id, company, scheduled_at }) => ({ id, company, scheduled_at })),
        recent: all.filter((d) => d.scheduled_at <= nowIso).slice(0, 12),
        weekly: Array.from(weeks, ([week, count]) => ({ week, count }))
          .sort((a, b) => a.week.localeCompare(b.week)).slice(-12),
      },
    };
  }

  // ── pipeline (outreach, real businesses only) ──
  let pipeline: InvestorOverview["pipeline"];
  if (targetsRes.error) {
    pipeline = fail(targetsRes.error.message);
  } else {
    const targets = ((targetsRes.data ?? []) as { name: string; source: string | null; segment: string | null; phone: string | null; status: string }[])
      .filter((t) => !isTestTarget(t));
    const order = ["identified", "researched", "drafted", "sent", "replied", "meeting", "won"];
    const counts = new Map<string, number>();
    for (const t of targets) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    const calls = (activityRes.data ?? []) as { outcome: string | null }[];
    pipeline = {
      ok: true,
      data: {
        stages: order.map((stage) => ({ stage, count: counts.get(stage) ?? 0 })),
        callsInRange: calls.length,
        connectedInRange: calls.filter((c) => ["connected", "interested", "callback", "not_interested"].includes(c.outcome ?? "")).length,
        interestedInRange: calls.filter((c) => c.outcome === "interested").length,
      },
    };
  }

  // ── product ──
  const gtm = (gtmRes.data ?? []) as { title: string; status: string; stand: string | null }[];
  const proxeBrand = ((brandRes.data ?? []) as { name: string; github_repos: string[] | null }[])
    .find((b) => b.name.toLowerCase().startsWith("proxe"));
  const commits = await githubCommits(proxeBrand?.github_repos ?? [], since);
  const product: InvestorOverview["product"] = {
    ok: true,
    data: {
      stage: gtm.map(({ title, status, stand }) => ({ title, status, stand })),
      shipped: (commits ?? []).slice(0, 10),
      commitsInRange: commits?.length ?? 0,
    },
  };

  type UpdateRow = InvestorOverview["updates"][number] & {
    stage: FeedItem["stage"];
    payload: { daily_budget?: number | null; targeting?: string | null } | null;
    pinned: boolean | null;
  };
  const updateRows = (updatesRes.data ?? []) as UpdateRow[];
  const updates = updateRows.map(({ id, title, body_md, kind, published_at }) => ({ id, title, body_md, kind, published_at }));

  // ── ad wallet ──
  // The live budget is the newest stated one: an ads post that is executing
  // or done overrides the budget a top-up was made for.
  const adPosts = updateRows
    .filter((u) => u.kind === "ads" && u.payload?.daily_budget && u.stage !== "plan")
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
  let adWallet: InvestorOverview["adWallet"] = null;
  if (topups.length) {
    const firstTopup = topups.map((t) => t.spent_on).sort()[0];
    const funded = topups.reduce((s, t) => s + Number(t.amount), 0);
    const metaConnected = Boolean(adAccountsByBrand()[PRODUCT]);
    const latestTopup = [...topups].sort((a, b) => b.spent_on.localeCompare(a.spent_on))[0];
    const launch = adPosts[0];
    const dailyBudget = launch?.payload?.daily_budget != null
      ? Number(launch.payload.daily_budget)
      : latestTopup.daily_budget != null ? Number(latestTopup.daily_budget) : null;

    let spent = adRows.filter((r) => r.day >= firstTopup).reduce((s, r) => s + Number(r.spend), 0);
    let estimated = false;
    // Without Meta, a wallet that never drains would claim money still there
    // after it is gone. Budget x days live is the honest stand-in, labelled.
    if (!metaConnected && launch && dailyBudget) {
      const liveDays = Math.max(0, Math.floor((Date.now() - new Date(launch.published_at).getTime()) / 864e5));
      spent = Math.min(funded, liveDays * dailyBudget);
      estimated = true;
    }
    const balance = funded - spent;
    adWallet = {
      funded,
      spent,
      balance,
      dailyBudget,
      daysLeft: dailyBudget ? Math.max(0, Math.floor(balance / dailyBudget)) : null,
      firstTopup,
      metaConnected,
      estimated,
    };
  }

  // ── feed ──
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const feed: FeedItem[] = [];
  for (const u of updateRows) {
    feed.push({
      id: `u-${u.id}`, at: u.published_at, type: "post", kind: u.kind, stage: u.stage ?? null,
      title: u.title, body: u.body_md || null, amount: null, pinned: Boolean(u.pinned),
      department: (u.payload as { department?: string } | null)?.department ?? DEPT_BY_KIND[u.kind] ?? "Operations",
      detail: u.kind === "ads" && u.payload
        ? { daily_budget: u.payload.daily_budget ?? null, targeting: u.payload.targeting ?? null }
        : null,
    });
  }
  for (const e of allExpenses) {
    const isTopup = e.category === "ad_topup";
    feed.push({
      id: `e-${e.id}`, at: `${e.spent_on}T12:00:00+05:30`, type: "money", kind: e.category, stage: "done",
      title: isTopup
        ? `${inr(Number(e.amount))} loaded into ${e.vendor || "the"} ad account`
        : `${inr(Number(e.amount))} paid to ${e.vendor || e.category}`,
      body: [e.description, isTopup && e.daily_budget ? `Funds ads at ${inr(Number(e.daily_budget))}/day.` : null]
        .filter(Boolean).join(" ") || null,
      amount: Number(e.amount), pinned: false, detail: null,
      department: e.department || (isTopup ? "Marketing" : "Operations"),
    });
  }
  const demoRows = (demoRes.data ?? []) as { id: string; company: string; scheduled_at: string; status: string; outcome: string | null }[];
  for (const d of demoRows) {
    if (d.status !== "done") continue;
    feed.push({
      id: `d-${d.id}`, at: d.scheduled_at, type: "demo", kind: "demo", stage: "done",
      title: ["Prospect", "PROXe lead"].includes(d.company) ? "Demo shown" : `Demo shown to ${d.company}`, body: d.outcome ? `Outcome: ${d.outcome.replace("_", " ")}.` : null,
      amount: null, pinned: false, detail: null, department: "Sales",
    });
  }
  feed.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at));

  // ── stake ──
  // Deployed money is attributed pro rata to what each investor actually
  // sent. The ratio is computed here and only the investor's own result
  // leaves the server: no round totals, no other investor's amounts.
  const isOwner = viewer.role === "owner";
  const fundBase = roundReceived || roundPromised;
  const ownBase = received || committed || 0;
  const shareOfRound = isOwner
    ? (fundBase ? 1 : null)
    : (ownBase && fundBase ? ownBase / fundBase : null);
  const yourDeployed = shareOfRound != null ? deployed * shareOfRound : null;
  const stake: InvestorOverview["stake"] = {
    promised: committed,
    received,
    roundPromised: isOwner ? roundPromised : null,
    roundReceived: isOwner ? roundReceived : null,
    shareOfRound: isOwner ? shareOfRound : null,
    equityPct,
    yourDeployed,
    roundDeployedPct: isOwner
      ? (fundBase ? Math.min(1, deployed / fundBase) : null)
      : (ownBase && yourDeployed != null ? Math.min(1, yourDeployed / ownBase) : null),
    investors: isOwner ? round.length : null,
    round: roundName,
    // Post-money implied by the round's terms (5% for 25L is 5Cr). Same for
    // every investor in the round, so it is not anyone's private figure.
    valuation: (() => {
      const t = round.find((r) => Number(r.equity_pct) > 0 && Number(r.committed_amount) > 0);
      return t ? Number(t.committed_amount) / (Number(t.equity_pct) / 100) : null;
    })(),
    equityEarned: equityPct != null && committed && received != null ? equityPct * (received / committed) : null,
    dilutedSoFar,
  };

  return {
    generatedAt: new Date().toISOString(),
    range: { days, since, until: untilStr },
    viewer: { role: viewer.role, name: viewerName },
    money: {
      committed,
      investedOn,
      deployed,
      deployedAds,
      deployedOther,
      runwayLeft: committed != null ? committed - deployed : null,
      dailyBurn,
    },
    spend,
    adWallet,
    ads,
    demos,
    pipeline,
    product,
    updates,
    traction,
    leads,
    sales,
    feed: feed.slice(0, 60),
    stake,
  };
}
