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
