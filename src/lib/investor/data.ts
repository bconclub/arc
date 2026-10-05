/**
 * Everything an investor sees, assembled server-side. SERVER ONLY.
 *
 * Scope is PROXe and nothing else: no client names from BCON, no receivables,
 * no other brand's ads. Each section degrades on its own — a dead Meta token
 * blanks the ads card, it does not take the page down — and says why, so an
 * empty card never reads as "zero".
 */
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { adAccountsByBrand, fetchMetaDaily, fetchMetaRunningAds, type MetaRunningAd } from "@/lib/ads/meta";
import { isTestTarget } from "@/lib/outreach-workflow";
import {
  fetchProxeDemoNotes, fetchProxeFunnel, fetchProxeLeads, fetchProxeSales, fetchProxeTraction, syncProxeDemos,
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
  /** how the feed colours it: money in (green), a conversion step (gold), money out, or work being done */
  tone: "paid" | "sales" | "spend" | "activity";
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
  /** the Ads tab: PROXe ads from 1 Oct 2026 only, from the routine's newest snapshot */
  adsDesk: Section<AdsDesk>;
  demos: Section<{
    inRange: number;
    done: number;
    noShow: number;
    upcoming: { id: string; company: string; scheduled_at: string }[];
    recent: { id: string; company: string; scheduled_at: string; status: string; outcome: string | null }[];
    weekly: { week: string; count: number }[];
    /** one entry per day of the window: demos booked and demos shown */
    daily: { day: string; booked: number; done: number }[];
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
  /** the business over the chosen window: the sequence, then money in and out */
  funnel: {
    incoming: number | null;
    /** distinct prospects the team called or emailed in the window */
    outbound: number;
    outboundCalls: number;
    outboundEmails: number;
    demosDone: number;
    linksShared: number;
    /** billing right now, not windowed */
    activeSubs: number | null;
    sales: number | null;
    salesCount: number;
    spentTotal: number;
    /** spend by department, each with the lines that make it up */
    spendGroups: { department: string; total: number; lines: { label: string; vendor: string; amount: number }[] }[];
    /** the same money by kind: ads, tools, people... */
    spendByType: { label: string; amount: number }[];
  };
  /** the plan, all time: where PROXe is against 5,000 leads, 1,000 demos, 100 customers */
  goal: {
    leads: number; demos: number; conversions: number;
    targets: { leads: number; demos: number; conversions: number };
  };
  /** the two things tracked day by day: demos booked, payment links out */
  activity: {
    demosBooked: number;
    linksShared: number;
    daily: { day: string; demos: number; links: number }[];
    recent: { at: string; kind: "demo" | "link"; title: string }[];
  };
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
    /** the round itself: terms, window, and how full it is */
    roundInfo: {
      name: string;
      target: number;
      equityOffered: number;
      opensOn: string;
      closesOn: string;
      raised: number;
      daysOpen: number;
      daysLeft: number;
    } | null;
  };
};

/** Investors look at ads from this day on, never earlier. */
export const ADS_FROM = "2026-10-01";

export type AdsDesk = {
  since: string;
  until: string;
  takenAt: string;
  source: string | null;
  /** rupees spent on PROXe ads since ADS_FROM */
  spend: number;
  /** leads the PROXe product received from ads since ADS_FROM */
  leads: number;
  /** leads as Meta counts them (pixel), usually lower than the product's count */
  metaLeads: number;
  cpl: number | null;
  impressions: number;
  clicks: number;
  daily: { day: string; spend: number; leads: number }[];
  campaigns: { name: string; status: string; spend: number; results: number; cpl: number | null }[];
  ads: { name: string; campaign: string | null; status: string; spend: number | null; leads: number; cpl: number | null }[];
  funnel: { leads: number; fromAds: number; replied: number; booked: number; demos: number; paid: number };
  site: { sessions: number; sample: number; bounced: number; noClick: number; clicked: number; mobileSeconds: number | null } | null;
  notes: string[];
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

// Outside calls (Dodo, the PROXe database, GitHub) are cached for a few
// minutes: fetched fresh on every load they made the page take ~17s, and
// none of them changes faster than an investor refreshes.
const FIVE_MIN = 300;
const cachedSales = unstable_cache(() => fetchProxeSales(), ["investor-sales"], { revalidate: FIVE_MIN });
const cachedTraction = unstable_cache((d: number) => fetchProxeTraction(d), ["investor-traction"], { revalidate: FIVE_MIN });
const cachedFunnel = unstable_cache((since: string) => fetchProxeFunnel(since), ["investor-funnel"], { revalidate: FIVE_MIN });
// The plan the round is raised against: 5,000 leads, 1,000 demos, 100 customers.
const GOAL = { leads: 5000, demos: 1000, conversions: 100 };
const GOAL_FROM = "2020-01-01";

const cachedDemoNotes = unstable_cache(() => fetchProxeDemoNotes(), ["investor-demo-notes"], { revalidate: FIVE_MIN });
const cachedLeads = unstable_cache((d: number) => fetchProxeLeads(d), ["investor-leads"], { revalidate: FIVE_MIN });
const cachedCommits = unstable_cache((repos: string[], since: string) => githubCommits(repos, since), ["investor-commits"], { revalidate: 900 });
// The demo mirror only needs refreshing every ten minutes.
const cachedDemoSync = unstable_cache(async () => {
  await syncProxeDemos();
  return Date.now();
}, ["investor-demo-sync"], { revalidate: 600 });

export async function buildInvestorOverview(viewer: Viewer, days: number): Promise<InvestorOverview> {
  const until = new Date();
  const sinceDate = new Date(until);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (days - 1));
  const since = iso(sinceDate);
  const untilStr = iso(until);

  // ── the money this view is accountable for ──
  // The round is the company's: its own terms and window. Investors carry only
  // what they actually sent, and equity is derived at the round's price.
  const roundNameWanted = viewer.role === "investor" ? viewer.investor.round : null;
  const { data: roundTermsRows } = await supabaseAdmin
    .from("rounds").select("name,target_amount,equity_offered_pct,opens_on,closes_on,status")
    .order("opens_on", { ascending: false });
  const terms = ((roundTermsRows ?? []) as { name: string; target_amount: number; equity_offered_pct: number; opens_on: string; closes_on: string; status: string }[])
    .find((r) => (roundNameWanted ? r.name === roundNameWanted : r.status === "open")) ?? null;
  const postMoney = terms ? Number(terms.target_amount) / (Number(terms.equity_offered_pct) / 100) : null;

  const { data: roundRows } = await supabaseAdmin
    .from("investors").select("committed_amount,received_amount,invested_on,round,equity_pct").eq("active", true);
  const round = ((roundRows ?? []) as { committed_amount: number | null; received_amount: number | null; invested_on: string | null; round: string | null; equity_pct: number | null }[])
    .filter((r) => !terms || !r.round || r.round === terms.name);
  const raisedInRound = round.reduce((s, r) => s + (Number(r.received_amount) || 0), 0);
  // Equity issued so far: everything received, at the round's price.
  const dilutedSoFar = postMoney ? (raisedInRound / postMoney) * 100 : null;
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
  // "All time" does not reach back ten years for ads: the money's first day is enough.
  const adFrom = days > 90 ? (investedOn ?? untilStr) : since;
  const syncFrom = investedOn && investedOn < adFrom ? investedOn : adFrom;
  // Meta caps history at 37 months; anything older simply returns empty.
  const sync = await syncAdSpend(syncFrom, untilStr);

  // Pull demo bookings from the PROXe product first, so the demo numbers are
  // the product's own record. A failed sync leaves the last mirror in place.
  const [, traction, leads, sales, proxeFunnel, demoNotes, outboundRes, funnelAll, outboundAllRes] = await Promise.all([
    cachedDemoSync().catch(() => null),
    cachedTraction(days).catch(() => null),
    cachedLeads(days).catch(() => null),
    cachedSales().catch(() => null),
    cachedFunnel(since).catch(() => null),
    cachedDemoNotes().catch(() => null),
    // Outbound is who we actually reached: calls and emails sent from ARC.
    supabaseAdmin.from("outreach_messages").select("target_id,channel,sent_at")
      .eq("direction", "out").not("sent_at", "is", null).gte("sent_at", `${since}T00:00:00Z`),
    // The plan is all time whatever the window.
    cachedFunnel(GOAL_FROM).catch(() => null),
    supabaseAdmin.from("outreach_messages").select("target_id").eq("direction", "out").not("sent_at", "is", null),
  ]);

  const [adRowsRes, expRes, demoRes, targetsRes, activityRes, updatesRes, gtmRes, brandRes] = await Promise.all([
    supabaseAdmin.from("ad_spend_daily").select("day,spend,leads,impressions,clicks")
      .eq("product", PRODUCT).gte("day", syncFrom).lte("day", untilStr),
    supabaseAdmin.from("expenses").select("*")
      .eq("product", PRODUCT).order("spent_on", { ascending: false }),
    supabaseAdmin.from("demos").select("id,company,scheduled_at,status,outcome,external_id")
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

  // ── ads desk: the routine's newest snapshot, 1 Oct onwards ──
  let adsDesk: InvestorOverview["adsDesk"];
  {
    const [snapRes, dailyRes] = await Promise.all([
      supabaseAdmin.from("ad_reports").select("taken_at,since,until,source,payload")
        .eq("product", PRODUCT).order("taken_at", { ascending: false }).limit(1),
      supabaseAdmin.from("ad_spend_daily").select("day,spend,leads")
        .eq("product", PRODUCT).gte("day", ADS_FROM).order("day"),
    ]);
    const snap = snapRes.data?.[0] as { taken_at: string; since: string; until: string; source: string | null; payload: Partial<AdsDesk> } | undefined;
    if (snapRes.error) {
      adsDesk = fail(missingTable(snapRes.error.message) ? "Ad reporting is being set up." : "Ad numbers did not load.");
    } else if (!snap) {
      adsDesk = fail("The first ads report lands after the next morning run.");
    } else {
      const p = snap.payload ?? {};
      const stored = ((dailyRes.data ?? []) as { day: string; spend: number; leads: number }[])
        .map((d) => ({ day: d.day, spend: Number(d.spend), leads: Number(d.leads) }));
      const daily = stored.length ? stored : (p.daily ?? []).filter((d) => d.day >= ADS_FROM);
      adsDesk = {
        ok: true,
        data: {
          since: snap.since < ADS_FROM ? ADS_FROM : snap.since,
          until: snap.until,
          takenAt: snap.taken_at,
          source: snap.source,
          spend: Number(p.spend ?? 0),
          leads: Number(p.leads ?? 0),
          metaLeads: Number(p.metaLeads ?? 0),
          cpl: p.leads ? Number(p.spend ?? 0) / Number(p.leads) : null,
          impressions: Number(p.impressions ?? 0),
          clicks: Number(p.clicks ?? 0),
          daily,
          campaigns: (p.campaigns ?? []).filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend),
          ads: (p.ads ?? []).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.leads - a.leads),
          funnel: p.funnel ?? { leads: 0, fromAds: 0, replied: 0, booked: 0, demos: 0, paid: 0 },
          site: p.site ?? null,
          notes: p.notes ?? [],
        },
      };
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
        daily: (() => {
          const by = new Map<string, { booked: number; done: number }>();
          for (const d of all) {
            if (d.status === "cancelled") continue;
            const day = d.scheduled_at.slice(0, 10);
            const cur = by.get(day) ?? { booked: 0, done: 0 };
            cur.booked += 1;
            if (d.status === "done") cur.done += 1;
            by.set(day, cur);
          }
          const out: { day: string; booked: number; done: number }[] = [];
          // All time starts at the first demo, not ten years of empty days.
          const firstDemo = all.map((d) => d.scheduled_at.slice(0, 10)).sort()[0] ?? untilStr;
          const start = firstDemo > since ? firstDemo : since;
          for (let t = new Date(`${start}T00:00:00Z`); iso(t) <= untilStr; t.setUTCDate(t.getUTCDate() + 1)) {
            const k = iso(t);
            out.push({ day: k, ...(by.get(k) ?? { booked: 0, done: 0 }) });
          }
          return out;
        })(),
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
  const commits = await cachedCommits(proxeBrand?.github_repos ?? [], since).catch(() => null);
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
      tone: /payment|paid|signed|closed|won|customer/i.test(u.title) ? "sales" : "activity",
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
      tone: "spend",
    });
  }
  const demoRows = (demoRes.data ?? []) as { id: string; company: string; scheduled_at: string; status: string; outcome: string | null }[];
  // One row per day, not per demo: "3 demos shown" reads; seven identical
  // rows do not.
  const demosByDay = new Map<string, { count: number; at: string; outcomes: string[] }>();
  for (const d of demoRows) {
    if (d.status !== "done") continue;
    const day = d.scheduled_at.slice(0, 10);
    const cur = demosByDay.get(day) ?? { count: 0, at: d.scheduled_at, outcomes: [] };
    cur.count += 1;
    if (d.scheduled_at > cur.at) cur.at = d.scheduled_at;
    if (d.outcome) cur.outcomes.push(d.outcome.replace("_", " "));
    demosByDay.set(day, cur);
  }
  for (const [day, g] of Array.from(demosByDay)) {
    feed.push({
      id: `d-${day}`, at: g.at, type: "demo", kind: "demo", stage: "done",
      title: g.count === 1 ? "Demo shown to a prospect" : `${g.count} demos shown to prospects`,
      body: g.outcomes.length ? `Outcomes: ${g.outcomes.join(", ")}.` : null,
      amount: null, pinned: false, detail: null, department: "Sales", tone: "activity",
    });
  }
  // Money in, straight from checkout: the moments a lead became a customer.
  for (const p of sales?.items ?? []) {
    feed.push({
      id: `s-${p.at}`, at: p.at, type: "money", kind: "sale", stage: "done",
      title: `Payment received from ${p.customer ?? "a customer"}: ₹${p.amount.toLocaleString("en-IN")}`,
      body: "Paid through the PROXe checkout.",
      amount: p.amount, pinned: false, detail: null, department: "Sales", tone: "paid",
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
    round: terms?.name ?? roundName,
    // Post-money implied by the round's terms (5% for 25L is 5Cr). Same for
    // every investor in the round, so it is not anyone's private figure.
    valuation: postMoney,
    equityEarned: postMoney && received != null ? (received / postMoney) * 100 : null,
    dilutedSoFar,
    roundInfo: terms
      ? (() => {
          const today = Date.parse(`${untilStr}T00:00:00Z`);
          const open = Date.parse(`${terms.opens_on}T00:00:00Z`);
          const close = Date.parse(`${terms.closes_on}T00:00:00Z`);
          return {
            name: terms.name,
            target: Number(terms.target_amount),
            equityOffered: Number(terms.equity_offered_pct),
            opensOn: terms.opens_on,
            closesOn: terms.closes_on,
            raised: raisedInRound,
            daysOpen: Math.max(1, Math.round((today - open) / 864e5) + 1),
            daysLeft: Math.max(0, Math.round((close - today) / 864e5)),
          };
        })()
      : null,
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
    adsDesk,
    demos,
    pipeline,
    product,
    updates,
    traction,
    leads,
    sales,
    feed: feed.slice(0, 60),
    ...(() => {
      const inWindow = (at: string) => at.slice(0, 10) >= since;
      const paid = (sales?.items ?? []).filter((p) => inWindow(p.at));

      // Outbound: distinct prospects touched, and how.
      const touches = (outboundRes.data ?? []) as { target_id: string; channel: string; sent_at: string }[];

      // Demos done: what the demo log says, plus what the team wrote in PROXe
      // call notes. One per lead, dated by its first record; founder-logged
      // demos have no lead and count one each.
      const doneAt = new Map<string, string>();
      const keep = (k: string, at: string) => { const c = doneAt.get(k); if (!c || at < c) doneAt.set(k, at); };
      for (const d of demoRows as { id: string; scheduled_at: string; status: string; external_id?: string | null }[]) {
        if (d.status !== "done") continue;
        const lead = d.external_id?.startsWith("proxe:") ? d.external_id.split(":")[1] : null;
        keep(lead ? `lead:${lead}` : `demo:${d.id}`, d.scheduled_at);
      }
      for (const n of demoNotes ?? []) keep(`lead:${n.lead}`, n.at);
      const demosDone = Array.from(doneAt.values()).filter(inWindow).length;

      // Payment links: logged by hand, plus everyone a Dodo checkout reached.
      const linkEvents = [
        ...updateRows.filter((u) => /payment link/i.test(u.title)).map((u) => ({ at: u.published_at, title: u.title })),
        ...(sales?.linkFirsts ?? []).map((at) => ({ at, title: "Checkout link opened by a customer" })),
      ];
      const links = linkEvents.filter((e) => inWindow(e.at));

      const booked = (demoRows as { scheduled_at: string; status: string; company: string }[])
        .filter((d) => d.status !== "cancelled" && inWindow(d.scheduled_at));

      // Spend, by department and by kind.
      const spent = allExpenses.filter((e) => e.spent_on >= since);
      const CAT: Record<string, string> = {
        ad_topup: "Ads", tools: "Tools & software", infra: "Infrastructure", calls: "Calling",
        people: "People", marketing: "Marketing", legal: "Legal", equipment: "Equipment", other: "Other",
      };
      const deptOf = (e: { category: string; department?: string | null }) =>
        e.department || (e.category === "ad_topup" ? "Marketing" : "Operations");
      const groups = new Map<string, Map<string, { label: string; vendor: string; amount: number }>>();
      const types = new Map<string, number>();
      for (const e of spent) {
        const dept = deptOf(e);
        const label = CAT[e.category] ?? e.category;
        const vendor = e.vendor || label;
        const g = groups.get(dept) ?? new Map();
        const line = g.get(`${label}|${vendor}`) ?? { label, vendor, amount: 0 };
        line.amount += Number(e.amount);
        g.set(`${label}|${vendor}`, line);
        groups.set(dept, g);
        types.set(label, (types.get(label) ?? 0) + Number(e.amount));
      }
      const spendGroups = Array.from(groups, ([department, g]) => {
        const lines = Array.from(g.values()).sort((x, y) => y.amount - x.amount);
        return { department, total: lines.reduce((t, l) => t + l.amount, 0), lines };
      }).sort((x, y) => y.total - x.total);

      // Day by day, from the window's start or the first event, whichever is later.
      const firstEvent = [...booked.map((d) => d.scheduled_at), ...links.map((l) => l.at)].map((x) => x.slice(0, 10)).sort()[0] ?? untilStr;
      const start = firstEvent > since ? firstEvent : since;
      const perDay = new Map<string, { demos: number; links: number }>();
      for (const d of booked) { const k = d.scheduled_at.slice(0, 10); const c = perDay.get(k) ?? { demos: 0, links: 0 }; c.demos += 1; perDay.set(k, c); }
      for (const l of links) { const k = l.at.slice(0, 10); const c = perDay.get(k) ?? { demos: 0, links: 0 }; c.links += 1; perDay.set(k, c); }
      const daily: { day: string; demos: number; links: number }[] = [];
      for (let t = new Date(`${start}T00:00:00Z`); iso(t) <= untilStr; t.setUTCDate(t.getUTCDate() + 1)) {
        const k = iso(t);
        daily.push({ day: k, ...(perDay.get(k) ?? { demos: 0, links: 0 }) });
      }

      return {
        goal: {
          leads: (funnelAll?.incoming ?? 0) + new Set(((outboundAllRes.data ?? []) as { target_id: string }[]).map((t) => t.target_id)).size,
          demos: doneAt.size,
          conversions: sales?.customers ?? 0,
          targets: GOAL,
        },
        funnel: {
          incoming: proxeFunnel?.incoming ?? null,
          outbound: new Set(touches.map((t) => t.target_id)).size,
          outboundCalls: touches.filter((t) => t.channel === "call").length,
          outboundEmails: touches.filter((t) => t.channel === "email").length,
          demosDone,
          linksShared: links.length,
          activeSubs: sales ? sales.activeSubs : null,
          sales: sales ? paid.reduce((t, p) => t + p.amount, 0) : null,
          salesCount: paid.length,
          spentTotal: spent.reduce((t, e) => t + Number(e.amount), 0),
          spendGroups,
          spendByType: Array.from(types, ([label, amount]) => ({ label, amount })).sort((x, y) => y.amount - x.amount),
        },
        activity: {
          demosBooked: booked.length,
          linksShared: links.length,
          daily,
          recent: [
            ...booked.map((d) => ({
              at: d.scheduled_at, kind: "demo" as const,
              title: d.company && !/^(PROXe lead|Prospect)$/i.test(d.company) ? `Demo booked with ${d.company}` : "Demo booked",
            })),
            ...links.map((l) => ({ at: l.at, kind: "link" as const, title: l.title })),
          ].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 8),
        },
      };
    })(),
    stake,
  };
}
