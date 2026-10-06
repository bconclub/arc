/**
 * Mirrors demo bookings from the PROXe product database into ARC's demos.
 * SERVER ONLY.
 *
 * PROXe stores a booking on the lead itself: all_leads.booking_date and
 * booking_time, with the outcome a founder logs at
 * unified_context.proxe.booking_outcome. The lead stage is the fallback
 * signal: a lead marked "Demo Taken" or "Proposal Sent" had its demo.
 *
 * Prospect names never leave this file: ARC stores "PROXe lead" as the
 * company, because the investor view is not a place for third parties'
 * personal details.
 *
 * Env: PROXE_DB_URL + PROXE_DB_SERVICE_KEY (the PROXe Supabase project).
 * Without them this is a no-op.
 */
import { supabaseAdmin } from "@/lib/supabase";

type Lead = {
  id: string;
  brand: string | null;
  booking_date: string | null;
  booking_time: string | null;
  lead_stage: string | null;
  unified_context: {
    proxe?: { booking_outcome?: { outcome?: string } | null };
    whatsapp?: { booking_cancelled_at?: string | null };
  } | null;
};

const DONE_STAGES = new Set(["Demo Taken", "Proposal Sent", "Closed Won", "Converted"]);

export function proxeSyncConfigured(): boolean {
  return Boolean(process.env.PROXE_DB_URL && process.env.PROXE_DB_SERVICE_KEY);
}

function statusFor(lead: Lead): { status: string; outcome: string | null } {
  const ctx = lead.unified_context ?? {};
  if (ctx.whatsapp?.booking_cancelled_at) return { status: "cancelled", outcome: null };
  const logged = ctx.proxe?.booking_outcome?.outcome;
  if (logged === "no_show") return { status: "no_show", outcome: null };
  if (logged === "done" || DONE_STAGES.has(lead.lead_stage ?? "")) {
    const outcome = lead.lead_stage === "Proposal Sent" ? "follow_up"
      : lead.lead_stage === "Closed Won" || lead.lead_stage === "Converted" ? "won"
      : lead.lead_stage === "Closed Lost" ? "lost" : null;
    return { status: "done", outcome };
  }
  // Booked, and either still ahead or nobody logged what happened.
  return { status: "scheduled", outcome: null };
}

/** "11:30 AM" / "15:00" → "HH:MM" in 24h; noon when unreadable. */
function toClock(t: string | null): string {
  const m = (t ?? "").match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return "12:00";
  let h = Number(m[1]);
  const min = m[2] ?? "00";
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(Math.min(h, 23)).padStart(2, "0")}:${min}`;
}

export async function syncProxeDemos(): Promise<{ synced: number } | { error: string }> {
  if (!proxeSyncConfigured()) return { error: "not configured" };
  const url = process.env.PROXE_DB_URL!;
  const key = process.env.PROXE_DB_SERVICE_KEY!;
  try {
    const res = await fetch(
      `${url}/rest/v1/all_leads?select=id,brand,booking_date,booking_time,lead_stage,unified_context&brand=eq.proxe&booking_date=not.is.null&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return { error: `PROXe answered ${res.status}` };
    const leads = (await res.json()) as Lead[];
    const rows = leads.map((l) => {
      const { status, outcome } = statusFor(l);
      return {
        product: "proxe",
        company: "PROXe lead",
        scheduled_at: `${l.booking_date}T${toClock(l.booking_time)}:00+05:30`,
        status,
        outcome,
        source: "proxe",
        external_id: `proxe:${l.id}:${l.booking_date}`,
      };
    });
    if (rows.length) {
      const { error } = await supabaseAdmin.from("demos").upsert(rows, { onConflict: "external_id" });
      if (error) return { error: error.message };
    }
    return { synced: rows.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "sync failed" };
  }
}

// ── Product traction, read live from PROXe ─────────────────────

export type ProxeTraction = {
  days: number;
  leads: number;
  leadsPrev: number;
  conversations: number;
  conversationsPrev: number;
  messages: number;
  messagesPrev: number;
  /** one touchpoint = one lead active on one channel on one day */
  channels: { channel: string; touchpoints: number; prev: number }[];
};

type Msg = { lead_id: string | null; channel: string | null; sender: string | null; created_at: string };

async function proxeRows<T>(path: string, url: string, key: string, cap = 10_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`PROXe answered ${res.status}`);
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/**
 * What PROXe actually did for its own pipeline over the window, against the
 * window before it. Brand "proxe" only: the same database also runs client
 * brands, and their conversations are not PROXe's traction to claim.
 */
export async function fetchProxeTraction(days: number): Promise<ProxeTraction | null> {
  if (!proxeSyncConfigured()) return null;
  const url = process.env.PROXE_DB_URL!;
  const key = process.env.PROXE_DB_SERVICE_KEY!;
  const now = Date.now();
  const start = new Date(now - days * 864e5).toISOString();
  const prevStart = new Date(now - 2 * days * 864e5).toISOString();

  const [msgs, leads] = await Promise.all([
    proxeRows<Msg>(`conversations?select=lead_id,channel,sender,created_at&brand=eq.proxe&created_at=gte.${prevStart}&order=created_at.asc`, url, key),
    proxeRows<{ created_at: string }>(`all_leads?select=created_at&brand=eq.proxe&created_at=gte.${prevStart}`, url, key),
  ]);

  const inCur = (t: string) => t >= start;
  const cur = msgs.filter((m) => inCur(m.created_at));
  const prev = msgs.filter((m) => !inCur(m.created_at));

  const touch = (rows: Msg[]) => {
    const by = new Map<string, Set<string>>();
    for (const m of rows) {
      if (!m.lead_id || !m.channel) continue;
      if (!by.has(m.channel)) by.set(m.channel, new Set());
      by.get(m.channel)!.add(`${m.lead_id}|${m.created_at.slice(0, 10)}`);
    }
    return by;
  };
  const tCur = touch(cur);
  const tPrev = touch(prev);
  const channels = Array.from(new Set([...Array.from(tCur.keys()), ...Array.from(tPrev.keys())]))
    .map((channel) => ({ channel, touchpoints: tCur.get(channel)?.size ?? 0, prev: tPrev.get(channel)?.size ?? 0 }))
    .filter((c) => c.touchpoints || c.prev)
    .sort((a, b) => b.touchpoints - a.touchpoints);

  const distinctLeads = (rows: Msg[]) => new Set(rows.map((m) => m.lead_id).filter(Boolean)).size;
  const agentMsgs = (rows: Msg[]) => rows.filter((m) => m.sender && m.sender !== "customer").length;

  return {
    days,
    leads: leads.filter((l) => inCur(l.created_at)).length,
    leadsPrev: leads.filter((l) => !inCur(l.created_at)).length,
    conversations: distinctLeads(cur),
    conversationsPrev: distinctLeads(prev),
    messages: agentMsgs(cur),
    messagesPrev: agentMsgs(prev),
    channels,
  };
}

// ── Sales, read live from Dodo Payments ─────────────────────────

export type ProxeSales = {
  /** rupees, succeeded payments only */
  total: number;
  payments: number;
  customers: number;
  last: string | null;
  /** each succeeded payment, newest first, for the feed */
  items: { at: string; amount: number; customer: string | null }[];
  /** when each person a checkout link reached first opened one, paid or not */
  linkFirsts: string[];
  /** subscriptions billing right now */
  activeSubs: number;
  /** active subscriptions still inside their free trial */
  trialSubs: number;
  /** each trial: who, when it started, when the first payment is due */
  trials: { customer: string | null; started: string; ends: string }[];
};

/**
 * PROXe's checkout runs on Dodo and nothing stores the payments elsewhere,
 * so the sales figure is asked of Dodo directly. Only succeeded payments
 * count; a link waiting on a card is not a sale. Env: DODO_PAYMENTS_API_KEY
 * (+ DODO_ENVIRONMENT, "test_mode" for the sandbox).
 */
// Checkouts made by the team to test the flow; never counted as sales or links.
const OWN_TEST_EMAILS = new Set(
  (process.env.PROXE_TEST_EMAILS ?? "bconclubx@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);

// The business behind a checkout: its email domain, unless it is a personal inbox.
const PERSONAL = /^(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|proton|protonmail|rediffmail)\./i;
function businessOf(email?: string): string | null {
  const domain = (email ?? "").split("@")[1]?.toLowerCase();
  if (!domain || PERSONAL.test(domain)) return null;
  const name = domain.split(".")[0] ?? "";
  return name ? name[0]!.toUpperCase() + name.slice(1) : null;
}

export async function fetchProxeSales(): Promise<ProxeSales | null> {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) return null;
  const base = (process.env.DODO_ENVIRONMENT ?? "").includes("test")
    ? "https://test.dodopayments.com"
    : "https://live.dodopayments.com";
  type P = { status?: string; total_amount?: number; currency?: string; created_at?: string; customer?: { customer_id?: string; email?: string; name?: string } };
  const all: P[] = [];
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`${base}/payments?page_size=100&page_number=${page}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Dodo answered ${res.status}`);
    const j = (await res.json()) as { items?: P[] };
    const items = j.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
  }
  const succeeded = all.filter((p) => p.status === "succeeded" && (p.currency ?? "INR") === "INR"
    && !OWN_TEST_EMAILS.has((p.customer?.email ?? "").toLowerCase()));
  // A trial starts with a small card check (₹100 on Dodo). It makes the
  // business a customer, but it is not a sale; real money is anything above it.
  const ok = succeeded.filter((p) => Number(p.total_amount ?? 0) > 100 * 100);
  return {
    total: ok.reduce((s, p) => s + Number(p.total_amount ?? 0), 0) / 100,
    payments: ok.length,
    customers: new Set(succeeded.map((p) => p.customer?.customer_id ?? p.customer?.email).filter(Boolean)).size,
    last: ok.map((p) => p.created_at ?? "").sort().pop() || null,
    linkFirsts: (() => {
      const first = new Map<string, string>();
      for (const p of all) {
        const who = p.customer?.customer_id ?? p.customer?.email;
        if (!who || !p.created_at) continue;
        // The founder testing his own checkout is not a link sent to a business.
        if (OWN_TEST_EMAILS.has((p.customer?.email ?? "").toLowerCase())) continue;
        const cur = first.get(who);
        if (!cur || p.created_at < cur) first.set(who, p.created_at);
      }
      return Array.from(first.values());
    })(),
    ...(await (async () => {
      const res = await fetch(`${base}/subscriptions?page_size=100&status=active`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      if (!res.ok) return { activeSubs: 0, trialSubs: 0, trials: [] };
      type S = { status?: string; created_at?: string; trial_period_days?: number; customer?: { name?: string; email?: string } };
      const active = (((await res.json()) as { items?: S[] }).items ?? [])
        .filter((s) => s.status === "active" && !OWN_TEST_EMAILS.has((s.customer?.email ?? "").toLowerCase()));
      // In trial until created + trial days; after that the subscription is paying.
      const trials = active
        .filter((s) => (s.trial_period_days ?? 0) > 0 && s.created_at)
        .map((s) => ({
          customer: businessOf(s.customer?.email) ?? (s.customer?.name?.trim() || null),
          started: s.created_at!,
          ends: new Date(Date.parse(s.created_at!) + (s.trial_period_days ?? 0) * 864e5).toISOString(),
        }))
        .filter((t) => Date.parse(t.ends) > Date.now())
        .sort((a, b) => a.ends.localeCompare(b.ends));
      return { activeSubs: active.length, trialSubs: trials.length, trials };
    })()),
    items: ok
      .map((p) => ({ at: p.created_at ?? "", amount: Number(p.total_amount ?? 0) / 100, customer: p.customer?.name?.trim() || null }))
      .filter((p) => p.at)
      .sort((a, b) => b.at.localeCompare(a.at)),
  };
}

// ── The funnel: what came in, what we went after ───────────────

/** Row count from a PostgREST count header; no rows are transferred. */
async function proxeCount(path: string, url: string, key: string): Promise<number> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PROXe answered ${res.status}`);
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

export type ProxeFunnel = { incoming: number; outbound: number };

/** Inbound leads PROXe took in, and prospects scraped for outbound, since a day. */
export async function fetchProxeFunnel(since: string): Promise<ProxeFunnel | null> {
  if (!proxeSyncConfigured()) return null;
  const url = process.env.PROXE_DB_URL!;
  const key = process.env.PROXE_DB_SERVICE_KEY!;
  const from = `created_at=gte.${since}T00:00:00Z`;
  const [incoming, outbound] = await Promise.all([
    proxeCount(`all_leads?select=id&brand=eq.proxe&${from}`, url, key),
    proxeCount(`proxe_outbound_prospects?select=id&brand=eq.proxe&${from}`, url, key),
  ]);
  return { incoming, outbound };
}

// ── Demos the team logged as done, from PROXe call notes ────────

// "The demo is done", "I took a demo", "gave him a demo", "saw the entire demo".
// Plans ("wants a demo", "booking a demo") do not match.
const DEMO_DONE = /demo (is |was )?(done|completed|taken)|(took|given|gave|showed|did|finished) (him |her |them )?(a |the )?demo|saw the (entire |whole |full )?demo|after the demo/i;

export async function fetchProxeDemoNotes(): Promise<{ lead: string; at: string }[] | null> {
  if (!proxeSyncConfigured()) return null;
  const rows = await proxeRows<{ lead_id: string | null; note: string | null; created_at: string }>(
    "activities?select=lead_id,note,created_at&note=ilike.*demo*&order=created_at.asc",
    process.env.PROXE_DB_URL!, process.env.PROXE_DB_SERVICE_KEY!,
  );
  return rows
    .filter((r) => r.lead_id && DEMO_DONE.test(r.note ?? ""))
    .map((r) => ({ lead: r.lead_id!, at: r.created_at }));
}

// ── Leads PROXe is handling ────────────────────────────────────

export type ProxeLeads = {
  /** open pipeline by PROXe's lead score: hot 80+, warm 40-79 */
  hot: number;
  warm: number;
  /** leads active in the window, by stage */
  stages: { stage: string; count: number }[];
  /** newest first; names reduced to initials before they leave the server */
  recent: { initials: string; channel: string | null; stage: string | null; at: string }[];
};

export async function fetchProxeLeads(days: number): Promise<ProxeLeads | null> {
  if (!proxeSyncConfigured()) return null;
  const url = process.env.PROXE_DB_URL!;
  const key = process.env.PROXE_DB_SERVICE_KEY!;
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rows = await proxeRows<{ customer_name: string | null; first_touchpoint: string | null; lead_stage: string | null; created_at: string; last_interaction_at: string | null }>(
    `all_leads?select=customer_name,first_touchpoint,lead_stage,created_at,last_interaction_at&brand=eq.proxe&last_interaction_at=gte.${since}&order=last_interaction_at.desc`,
    url, key,
  );
  // Warm and hot are the whole open pipeline, not just this window: a warm
  // lead from three weeks ago is still warm. Closed deals are out either way.
  const scored = await proxeRows<{ lead_score: number | null; lead_stage: string | null }>(
    `all_leads?select=lead_score,lead_stage&brand=eq.proxe&lead_score=gte.40`,
    url, key,
  );
  const open = scored.filter((r) => !/closed|converted|lost/i.test(r.lead_stage ?? ""));
  const hot = open.filter((r) => (r.lead_score ?? 0) >= 80).length;
  const warm = open.filter((r) => (r.lead_score ?? 0) >= 40 && (r.lead_score ?? 0) < 80).length;

  const stages = new Map<string, number>();
  for (const r of rows) {
    const s = r.lead_stage || "New";
    stages.set(s, (stages.get(s) ?? 0) + 1);
  }
  const initials = (n: string | null) =>
    (n ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return {
    hot,
    warm,
    stages: Array.from(stages, ([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count),
    recent: rows.slice(0, 8).map((r) => ({
      initials: initials(r.customer_name),
      channel: r.first_touchpoint,
      stage: r.lead_stage,
      at: r.last_interaction_at ?? r.created_at,
    })),
  };
}
