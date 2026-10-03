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

export const PRODUCT = "proxe";

export type Viewer =
  | { role: "owner" }
  | {
      role: "investor";
      investor: {
        id: string;
        name: string;
        committed_amount: number | null;
        currency: string;
        invested_on: string | null;
      };
    };

type Section<T> = { ok: true; data: T } | { ok: false; reason: string };

export type DaySpend = { day: string; ads: number; other: number; leads: number };

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
    ledger: { id: string; spent_on: string; category: string; vendor: string | null; description: string | null; amount: number }[];
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

export async function buildInvestorOverview(viewer: Viewer, days: number): Promise<InvestorOverview> {
  const until = new Date();
  const sinceDate = new Date(until);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (days - 1));
  const since = iso(sinceDate);
  const untilStr = iso(until);

  // ── the money this view is accountable for ──
  let committed: number | null = null;
  let investedOn: string | null = null;
  let viewerName = "Owner preview";
  if (viewer.role === "investor") {
    committed = viewer.investor.committed_amount;
    investedOn = viewer.investor.invested_on;
    viewerName = viewer.investor.name;
  } else {
    // The owner previews the combined picture across every active investor.
    const { data } = await supabaseAdmin
      .from("investors").select("committed_amount,invested_on").eq("active", true);
    const rows = data ?? [];
    if (rows.length) {
      committed = rows.reduce((s, r) => s + (Number(r.committed_amount) || 0), 0) || null;
      investedOn = rows.map((r) => r.invested_on).filter(Boolean).sort()[0] ?? null;
    }
  }

  // Sync ads for whichever window is wider: the view, or since the money landed.
  const syncFrom = investedOn && investedOn < since ? investedOn : since;
  // Meta caps history at 37 months; anything older simply returns empty.
  const sync = await syncAdSpend(syncFrom, untilStr);

  const [adRowsRes, expRes, demoRes, targetsRes, activityRes, updatesRes, gtmRes, brandRes] = await Promise.all([
    supabaseAdmin.from("ad_spend_daily").select("day,spend,leads,impressions,clicks")
      .eq("product", PRODUCT).gte("day", syncFrom).lte("day", untilStr),
    supabaseAdmin.from("expenses").select("id,spent_on,category,vendor,description,amount,daily_budget")
      .eq("product", PRODUCT).order("spent_on", { ascending: false }),
    supabaseAdmin.from("demos").select("id,company,scheduled_at,status,outcome")
      .eq("product", PRODUCT).order("scheduled_at", { ascending: false }),
    supabaseAdmin.from("outreach_targets").select("name,source,segment,phone,status,kind").eq("kind", "business"),
    supabaseAdmin.from("outreach_activity").select("channel,outcome,occurred_at")
      .eq("channel", "call").gte("occurred_at", `${since}T00:00:00Z`),
    supabaseAdmin.from("investor_updates").select("id,title,body_md,kind,published_at")
      .eq("published", true).order("published_at", { ascending: false }).limit(20),
    supabaseAdmin.from("gtm_areas").select("title,status,stand,ord").order("ord"),
    supabaseAdmin.from("brands").select("name,github_repos"),
  ]);

  // ── spend ──
  const adRows = (adRowsRes.data ?? []) as { day: string; spend: number; leads: number; impressions: number; clicks: number }[];
  const allExpenses = (expRes.data ?? []) as { id: string; spent_on: string; category: string; vendor: string | null; description: string | null; amount: number; daily_budget: number | null }[];
  // Top-ups move cash into the ad wallet; Meta's spend is what drains it. Counting
  // both would double the same rupees, so top-ups stay out of the spend lines and
  // are reconciled against Meta in the wallet instead.
  const topups = allExpenses.filter((e) => e.category === "ad_topup");
  const expenses = allExpenses.filter((e) => e.category !== "ad_topup");

  const adsByDay = new Map(adRows.map((r) => [r.day, r]));
  const otherByDay = new Map<string, number>();
  for (const e of expenses) {
    if (e.spent_on < since || e.spent_on > untilStr) continue;
    otherByDay.set(e.spent_on, (otherByDay.get(e.spent_on) ?? 0) + Number(e.amount));
  }
  const daily: DaySpend[] = [];
  for (let d = new Date(sinceDate); iso(d) <= untilStr; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = iso(d);
    const a = adsByDay.get(key);
    daily.push({ day: key, ads: Number(a?.spend ?? 0), other: otherByDay.get(key) ?? 0, leads: Number(a?.leads ?? 0) });
  }
  const adsInRange = daily.reduce((s, d) => s + d.ads, 0);
  const otherInRange = daily.reduce((s, d) => s + d.other, 0);

  const cat = new Map<string, number>();
  if (adsInRange) cat.set("ads", adsInRange);
  for (const e of expenses) {
    if (e.spent_on < since || e.spent_on > untilStr) continue;
    cat.set(e.category, (cat.get(e.category) ?? 0) + Number(e.amount));
  }

  const spend: InvestorOverview["spend"] = expRes.error && missingTable(expRes.error.message)
    ? fail("Spend ledger not set up yet.")
    : {
        ok: true,
        data: {
          total: adsInRange + otherInRange,
          ads: adsInRange,
          other: otherInRange,
          daily,
          byCategory: Array.from(cat, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
          ledger: allExpenses.filter((e) => e.spent_on >= since && e.spent_on <= untilStr).slice(0, 50),
        },
      };

  // ── deployment since the money landed ──
  const metaSinceInvest = investedOn
    ? adRows.filter((r) => r.day >= investedOn!).reduce((s, r) => s + Number(r.spend), 0)
    : adRows.reduce((s, r) => s + Number(r.spend), 0);
  const topupsSinceInvest = topups
    .filter((e) => !investedOn || e.spent_on >= investedOn)
    .reduce((s, e) => s + Number(e.amount), 0);
  // Cash out to ads is whichever is larger: what was loaded into the wallet, or
  // what Meta spent (spend can run ahead of logged top-ups on a card account).
  const deployedAds = Math.max(metaSinceInvest, topupsSinceInvest);
  const deployedOther = expenses
    .filter((e) => !investedOn || e.spent_on >= investedOn)
    .reduce((s, e) => s + Number(e.amount), 0);
  const deployed = deployedAds + deployedOther;
  const dailyBurn = (adsInRange + otherInRange) / days;

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
      ads = fail(sync.reason ?? (e instanceof Error ? e.message : "Meta did not answer."));
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

  const updates = (updatesRes.data ?? []) as InvestorOverview["updates"];

  let adWallet: InvestorOverview["adWallet"] = null;
  if (topups.length) {
    const firstTopup = topups.map((t) => t.spent_on).sort()[0];
    const funded = topups.reduce((s, t) => s + Number(t.amount), 0);
    const spentMeta = adRows.filter((r) => r.day >= firstTopup).reduce((s, r) => s + Number(r.spend), 0);
    const latest = [...topups].sort((a, b) => b.spent_on.localeCompare(a.spent_on))[0];
    const dailyBudget = latest.daily_budget != null ? Number(latest.daily_budget) : null;
    const balance = funded - spentMeta;
    adWallet = {
      funded,
      spent: spentMeta,
      balance,
      dailyBudget,
      daysLeft: dailyBudget ? Math.max(0, Math.floor(balance / dailyBudget)) : null,
      firstTopup,
      metaConnected: Boolean(adAccountsByBrand()[PRODUCT]),
    };
  }

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
  };
}
