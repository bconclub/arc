/**
 * Keeps the investor Ads tab current. The tab reads the newest ad_reports row;
 * these used to be written by hand from Ads Manager, so the tab went stale the
 * moment nobody did it. Now, when the newest report is over six hours old, a
 * fresh one is built from:
 *
 * - Meta (read-only, META_ACCESS_TOKEN): spend, impressions, link clicks, Meta's
 *   lead count, and per-campaign / per-ad spend and results with live status.
 *   A WhatsApp campaign's result is conversations started.
 * - PROXe (PROXE_DB_URL): the lead funnel since ADS_FROM. "From ads" is a lead
 *   whose landing link carried a Meta click id or an fb/ig utm_source; per-ad
 *   leads match the link's utm_content to the ad name.
 * - ARC demos: demos held since ADS_FROM.
 *
 * Site behaviour (Clarity) has no API here, so it is carried from the last
 * report and labelled with its date. SERVER ONLY.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { adAccountsByBrand, fetchMetaBreakdown } from "@/lib/ads/meta";
import { proxeSyncConfigured } from "@/lib/investor/proxe-sync";

const STALE_MS = 6 * 3600_000;
const AD_SOURCES = new Set(["fb", "ig", "facebook", "instagram", "an", "msg"]);
const BOOKED = new Set(["Booking Made", "Demo Taken", "Proposal Sent", "Closed Won"]);

type Lead = {
  email: string | null; lead_stage: string | null; response_count: number | null; booking_date: string | null;
  converted_at: string | null; unified_context: { web?: { attribution?: Record<string, string> } } | null;
};

async function proxeLeadsSince(since: string): Promise<Lead[]> {
  const url = process.env.PROXE_DB_URL!, key = process.env.PROXE_DB_SERVICE_KEY!;
  const out: Lead[] = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(
      `${url}/rest/v1/all_leads?select=email,lead_stage,response_count,booking_date,converted_at,unified_context&brand=eq.proxe&created_at=gte.${since}T00:00:00Z&order=created_at.asc&offset=${offset}&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!r.ok) throw new Error(`PROXe answered ${r.status}`);
    const page = (await r.json()) as Lead[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

const attribution = (l: Lead) => l.unified_context?.web?.attribution ?? {};
const fromAd = (l: Lead) => {
  const a = attribution(l);
  return Boolean(a.fbclid) || AD_SOURCES.has(String(a.utm_source || "").toLowerCase());
};
const short = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Builds and stores a fresh report if the newest is older than six hours. Never throws. */
export async function refreshAdsSnapshot(product: string, adsFrom: string): Promise<{ refreshed: boolean; reason?: string }> {
  try {
    const { data: last } = await supabaseAdmin.from("ad_reports").select("taken_at,payload")
      .eq("product", product).order("taken_at", { ascending: false }).limit(1);
    const prev = last?.[0] as { taken_at: string; payload: Record<string, unknown> } | undefined;
    if (prev && Date.now() - Date.parse(prev.taken_at) < STALE_MS) return { refreshed: false, reason: "fresh" };

    const account = adAccountsByBrand()[product];
    if (!account) return { refreshed: false, reason: "no ad account" };
    const until = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // IST today
    const [meta, leads, demosRes, dailyRes] = await Promise.all([
      fetchMetaBreakdown(account, adsFrom, until),
      proxeSyncConfigured() ? proxeLeadsSince(adsFrom) : Promise.resolve([] as Lead[]),
      supabaseAdmin.from("demos").select("status,scheduled_at").eq("product", product).gte("scheduled_at", `${adsFrom}T00:00:00Z`),
      supabaseAdmin.from("ad_spend_daily").select("day,spend,leads").eq("product", product).gte("day", adsFrom).order("day"),
    ]);

    const tests = new Set((process.env.PROXE_TEST_EMAILS ?? "bconclubx@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
    const real = leads.filter((l) => !(l.email && tests.has(l.email.toLowerCase())));
    const adLeads = real.filter(fromAd);
    const perAd = new Map<string, number>();
    for (const l of adLeads) {
      const name = String(attribution(l).utm_content || "").trim();
      if (name) perAd.set(name, (perAd.get(name) ?? 0) + 1);
    }

    const isWa = (o: string | null, name: string) => /ENGAGEMENT|MESSAGES/i.test(o || "") || /whatsapp/i.test(name);
    const campaigns = meta.campaigns.map((c) => {
      const results = isWa(c.objective, c.name) ? c.conversations : c.leads;
      return { name: c.name, status: c.status === "ACTIVE" ? "Active" : "Off", spend: Math.round(c.spend * 100) / 100, results, cpl: results ? Math.round((c.spend / results) * 100) / 100 : null };
    });
    const ads = meta.ads.map((a) => {
      const leadsHere = perAd.get(a.name) ?? a.leads;
      return { name: a.name, campaign: a.campaign, status: a.status === "ACTIVE" ? "Active" : "Off", spend: Math.round(a.spend * 100) / 100, leads: leadsHere, cpl: leadsHere ? Math.round((a.spend / leadsHere) * 100) / 100 : null };
    });
    const spend = meta.campaigns.reduce((s, c) => s + c.spend, 0);
    const conversations = meta.campaigns.reduce((s, c) => s + c.conversations, 0);
    const demos = ((demosRes.data ?? []) as { status: string }[]).filter((d) => d.status === "done").length;

    const prevSite = (prev?.payload?.site as Record<string, unknown> | undefined) ?? null;
    const payload = {
      spend: Math.round(spend * 100) / 100,
      leads: adLeads.length,
      metaLeads: meta.campaigns.reduce((s, c) => s + c.leads, 0),
      impressions: meta.campaigns.reduce((s, c) => s + c.impressions, 0),
      clicks: meta.campaigns.reduce((s, c) => s + c.clicks, 0),
      daily: ((dailyRes.data ?? []) as { day: string; spend: number; leads: number }[]).map((d) => ({ day: d.day, spend: Number(d.spend), leads: Number(d.leads) })),
      campaigns,
      ads,
      funnel: {
        leads: real.length,
        fromAds: adLeads.length,
        replied: real.filter((l) => (l.response_count ?? 0) > 0).length,
        booked: real.filter((l) => l.booking_date || BOOKED.has(l.lead_stage ?? "")).length,
        demos,
        paid: real.filter((l) => l.lead_stage === "Closed Won").length,
      },
      site: prevSite,
      notes: [
        `Counted from ${short(adsFrom)}, the launch of the UGC v3 campaigns. Earlier ads are not included.`,
        "Spend, impressions, link clicks and Meta's own lead count come from Meta. Leads, replies, bookings and paid come from the PROXe product, which also counts leads Meta's pixel misses.",
        "A lead counts as from ads when it arrived through a Meta ad link. WhatsApp campaign results are conversations started" + (conversations ? ` (${conversations} so far).` : "."),
        "Meta's Lead event was tightened on 9 Oct to fire only for name + phone + business, so Meta's lead count after that date is lower and cleaner.",
        ...(prevSite && prev ? [`Site behaviour (Clarity) is from the ${short(prev.taken_at)} report.`] : []),
        "Today's spend is partial until the day ends.",
      ],
    };
    const { error } = await supabaseAdmin.from("ad_reports").insert({ product, since: adsFrom, until, source: "meta_api", payload });
    if (error) return { refreshed: false, reason: error.message };
    return { refreshed: true };
  } catch (e) {
    return { refreshed: false, reason: e instanceof Error ? e.message : "refresh failed" };
  }
}
