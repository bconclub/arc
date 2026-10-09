/**
 * Inbound PROXe leads, mirrored into ARC's outreach list so the sales team works
 * inbound and outbound in one place with the same tools (call log, follow-ups,
 * research, assignment). SERVER ONLY.
 *
 * PROXe stays the owner of the contact (docs/OUTREACH-WORKFLOW.md): this copy
 * carries PROXe's stage, score, channel and brand in `inbound`, refreshed each
 * sync, while ARC's own status, notes and owner are the team's working state and
 * are never overwritten. Mirrored rows have source 'proxe_inbound', which the AI
 * cold-caller's endpoints exclude.
 *
 * Env: PROXE_DB_URL + PROXE_DB_SERVICE_KEY (as for the investor sync).
 * PROXE_INBOUND_BRANDS picks PROXe brands to mirror (comma list, default "proxe").
 */
import { supabaseAdmin } from "@/lib/supabase";
import { proxeSyncConfigured } from "@/lib/investor/proxe-sync";

export const INBOUND_SOURCE = "proxe_inbound";
const SYNCED_KEY = "proxe_inbound_synced_at";
const STALE_MS = 5 * 60_000;

type ProxeLead = {
  id: string; customer_name: string | null; email: string | null; phone: string | null
  first_touchpoint: string | null; last_touchpoint: string | null; lead_stage: string | null; sub_stage: string | null
  lead_score: number | null; brand: string | null; created_at: string; last_interaction_at: string | null
  booking_date: string | null; booking_time: string | null; needs_human_followup: boolean | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

/** A first ARC stage for a newly mirrored lead, from where PROXe has it. */
function startStatus(stage: string | null): string {
  const s = (stage || "").toLowerCase();
  if (/closed won|converted/.test(s)) return "won";
  if (/closed lost|lost/.test(s)) return "lost";
  if (/booking|demo|proposal/.test(s)) return "meeting";
  return "identified";
}

const brands = () => (process.env.PROXE_INBOUND_BRANDS || "proxe").split(",").map((b) => b.trim().toLowerCase()).filter(Boolean);
const testEmails = () => new Set((process.env.PROXE_TEST_EMAILS ?? "bconclubx@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

async function fetchLeads(): Promise<ProxeLead[]> {
  const url = process.env.PROXE_DB_URL!, key = process.env.PROXE_DB_SERVICE_KEY!;
  const cols = "id,customer_name,email,phone,first_touchpoint,last_touchpoint,lead_stage,sub_stage,lead_score,brand,created_at,last_interaction_at,booking_date,booking_time,needs_human_followup";
  const out: ProxeLead[] = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(
      `${url}/rest/v1/all_leads?select=${cols}&brand=in.(${brands().map(encodeURIComponent).join(",")})&order=created_at.asc&offset=${offset}&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!r.ok) throw new Error(`PROXe answered ${r.status}`);
    const page = (await r.json()) as ProxeLead[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export async function lastInboundSync(): Promise<string | null> {
  const { data } = await db.from("arc_context").select("value").eq("key", SYNCED_KEY).maybeSingle();
  return (data?.value as string) || null;
}

/**
 * Pull every inbound lead and upsert its mirror. New leads are inserted with a
 * starting stage; existing ones only get PROXe's fields refreshed (plus phone or
 * email if ARC had none). With `ifStale`, does nothing if synced in the last 5 minutes.
 */
export async function syncInboundLeads(opts: { ifStale?: boolean } = {}): Promise<{ added: number; refreshed: number; skipped?: string }> {
  if (!proxeSyncConfigured()) return { added: 0, refreshed: 0, skipped: "PROXe database is not connected (PROXE_DB_URL)." };
  if (opts.ifStale) {
    const last = await lastInboundSync();
    if (last && Date.now() - Date.parse(last) < STALE_MS) return { added: 0, refreshed: 0, skipped: "fresh" };
  }
  const tests = testEmails();
  const leads = (await fetchLeads()).filter((l) => !(l.email && tests.has(l.email.toLowerCase())));

  const { data: existing, error } = await db.from("outreach_targets").select("id,proxe_lead_id,phone,email,inbound").not("proxe_lead_id", "is", null);
  if (error) throw new Error(error.message);
  type Mirror = { id: string; proxe_lead_id: string; phone: string | null; email: string | null; inbound: Record<string, unknown> | null };
  const byLead = new Map<string, Mirror>((existing || []).map((t: Mirror) => [t.proxe_lead_id, t]));
  // Key order is fixed by inboundOf, but Postgres jsonb reorders keys: compare sorted.
  const same = (a: unknown, b: unknown) => JSON.stringify(a, Object.keys((a || {}) as object).sort()) === JSON.stringify(b, Object.keys((b || {}) as object).sort());

  const inboundOf = (l: ProxeLead) => ({
    stage: l.lead_stage, sub_stage: l.sub_stage, score: l.lead_score, brand: l.brand,
    channel: l.first_touchpoint, last_channel: l.last_touchpoint,
    came_in_at: l.created_at, last_at: l.last_interaction_at,
    booking: l.booking_date ? `${l.booking_date}${l.booking_time ? " " + l.booking_time.slice(0, 5) : ""}` : null,
    needs_human: Boolean(l.needs_human_followup),
  });

  const fresh = leads.filter((l) => !byLead.has(l.id)).map((l) => ({
    kind: "business",
    name: (l.customer_name || "").trim() || l.phone || l.email || "PROXe lead",
    phone: l.phone, email: l.email,
    source: INBOUND_SOURCE, status: startStatus(l.lead_stage),
    proxe_lead_id: l.id, inbound: inboundOf(l),
  }));
  for (let i = 0; i < fresh.length; i += 500) {
    const { error: e } = await db.from("outreach_targets").insert(fresh.slice(i, i + 500));
    if (e) throw new Error(e.message);
  }

  let refreshed = 0;
  // Only rows whose PROXe side changed, so a sync doesn't touch every lead.
  const known = leads.filter((l) => {
    const t = byLead.get(l.id);
    return t && (!same(t.inbound, inboundOf(l)) || (!t.phone && l.phone) || (!t.email && l.email));
  });
  for (let i = 0; i < known.length; i += 20) {
    await Promise.all(known.slice(i, i + 20).map(async (l) => {
      const t = byLead.get(l.id)!;
      const patch: Record<string, unknown> = { inbound: inboundOf(l) };
      if (!t.phone && l.phone) patch.phone = l.phone;
      if (!t.email && l.email) patch.email = l.email;
      const { error: e } = await db.from("outreach_targets").update(patch).eq("id", t.id);
      if (!e) refreshed++;
    }));
  }

  await db.from("arc_context").upsert({ key: SYNCED_KEY, value: new Date().toISOString(), updated_at: new Date().toISOString() });
  return { added: fresh.length, refreshed };
}
