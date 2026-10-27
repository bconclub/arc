/**
 * ARC -> PROXe outbound mirror. SERVER ONLY.
 *
 * ARC stays the source of truth for cold outreach. Every call logged through
 * /api/agent/outreach-call is copied into BCON PROXe (PROXE_DB_URL +
 * PROXE_DB_SERVICE_KEY) so the PROXe dashboard sees the same history:
 *
 * - proxe_outbound_prospects: one row per ARC target (external_system 'arc',
 *   external_id = target id), the shape the 28 Sep backfill used.
 * - proxe_outbound_activity: one row per ARC call message
 *   (external_id 'message:<outreach_messages.id>', same as the backfill).
 * - disposition "interested" on a real (non-test) prospect promotes it into
 *   all_leads, linked both ways (prospect.lead_id, target.proxe_lead_id).
 * - "callback" or "interested" WITH a clock time in callback_request is a
 *   booking: PROXe's /api/agent/outreach/call-booking creates the lead, sets
 *   Booking Made and sends its connected-callback confirmation, the same as a
 *   teammate logging the call. Idempotent on the conversation id there, so a
 *   webhook replay never makes a second lead or a second message.
 *
 * Until 26 Oct nothing ran this after the one-off backfill, so PROXe stopped
 * at 23 Sep. Every write is idempotent on the unique (brand, external_system,
 * external_id) keys, so a retry or a backfill run never duplicates.
 */
import { supabaseAdmin } from "@/lib/supabase"
import { isTestTarget } from "@/lib/outreach-workflow"
import { proxeSyncConfigured } from "@/lib/investor/proxe-sync"
import { parseCallbackTime, parseCallbackDay, contactNameFromTranscript } from "@/lib/callback-time"

type Target = {
  id: string; kind: string | null; name: string | null; org: string | null; segment: string | null; city: string | null
  email: string | null; phone: string | null; linkedin: string | null; website: string | null; why_them: string | null
  research: string | null; notes: string | null; status: string | null; source: string | null; created_at: string | null
  proxe_lead_id: string | null
}
type Prospect = { id: string; status: string; lead_id: string | null; promoted_at: string | null }

export type MirrorInput = {
  targetId: string
  messageId: string
  disposition: string
  body: string
  occurredAt: string
  conversationId?: string | null
  recordingUrl?: string | null
  agentId?: string | null
  callbackRequest?: string | null
  contactName?: string | null
}
type Booking = { date: string; time: string; duplicate: boolean; message: { sent: boolean; template: string | null; mode: string | null; wa_message_id: string | null; error: string | null } | null }
export type MirrorResult =
  | { ok: true; prospect_id: string; activity: "inserted" | "exists"; test: boolean; lead_id: string | null; promoted: boolean; booking?: (Booking & { lead_id: string }) | { error: string } }
  | { ok: false; error: string }

async function px<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const url = process.env.PROXE_DB_URL!, key = process.env.PROXE_DB_SERVICE_KEY!
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    cache: "no-store",
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`PROXe ${init.method || "GET"} ${path.split("?")[0]} ${r.status}: ${text.slice(0, 200)}`)
  return (text ? JSON.parse(text) : null) as T
}

const tail10 = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-10)

/** Call disposition -> proxe_outbound_prospects.status. Never walks back a handoff. */
function prospectStatus(disposition: string, prior: string | null): string {
  if (prior === "handed_off" || prior === "qualified") return prior
  switch (disposition) {
    case "interested": case "callback": case "connected": return "connected"
    case "not_interested": case "wrong_number": return "lost"
    default: return prior === "connected" ? "connected" : "attempted"
  }
}

export async function mirrorCallToProxe(input: MirrorInput): Promise<MirrorResult> {
  if (!proxeSyncConfigured()) return { ok: false, error: "PROXe mirror not configured (PROXE_DB_URL / PROXE_DB_SERVICE_KEY)" }
  try {
    const { data: t, error } = await supabaseAdmin.from("outreach_targets")
      .select("id,kind,name,org,segment,city,email,phone,linkedin,website,why_them,research,notes,status,source,created_at,proxe_lead_id")
      .eq("id", input.targetId).maybeSingle()
    if (error || !t) return { ok: false, error: `target ${input.targetId} unreadable` }
    const target = t as Target
    const test = isTestTarget(target as unknown as Parameters<typeof isTestTarget>[0])
    const key = `brand=eq.proxe&external_system=eq.arc&external_id=eq.${target.id}`

    // 1. Prospect: insert on first sight, else refresh the status only.
    const found = await px<Prospect[]>(`proxe_outbound_prospects?select=id,status,lead_id,promoted_at&${key}`)
    let prospect = found[0]
    const status = prospectStatus(input.disposition, prospect?.status ?? null)
    if (!prospect) {
      const rows = await px<Prospect[]>("proxe_outbound_prospects?on_conflict=brand,external_system,external_id&select=id,status,lead_id,promoted_at", {
        method: "POST", prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({
          brand: "proxe", external_system: "arc", external_id: target.id,
          source: test ? "test" : target.source || "arc", source_batch: target.source || null,
          name: test && !/\[TEST\]/.test(target.name || "") ? `${target.name || "Test"} [TEST]` : target.name || target.org || "Unknown",
          organization: target.org, segment: test ? "test_dial" : target.segment, city: target.city,
          phone: target.phone, email: target.email, website: target.website, linkedin: target.linkedin,
          why_them: target.why_them, research: target.research, notes: target.notes, status,
          source_payload: { arc_kind: target.kind, arc_status: target.status, ...(test ? { test: true } : {}) },
          source_observed_at: target.created_at || new Date().toISOString(),
        }),
      })
      prospect = rows[0]
    } else if (status !== prospect.status) {
      await px(`proxe_outbound_prospects?id=eq.${prospect.id}`, {
        method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      })
    }

    // 2. Activity, keyed on the ARC message so a re-run is a no-op.
    const inserted = await px<unknown[]>("proxe_outbound_activity?on_conflict=brand,external_system,external_id", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=representation",
      body: JSON.stringify({
        brand: "proxe", prospect_id: prospect.id, external_system: "arc", external_id: `message:${input.messageId}`,
        channel: "call", outcome: input.disposition || "unknown",
        summary: `${test ? "[TEST CALL] " : ""}${input.body}`.slice(0, 8000),
        evidence_url: input.recordingUrl || null, occurred_at: input.occurredAt,
        payload: {
          ...(test ? { test: true } : {}), arc_target_id: target.id, arc_message_id: input.messageId,
          conversation_id: input.conversationId || null, agent_id: input.agentId || null,
        },
      }),
    })

    // 3. Agreed a time -> PROXe booking. Interested without one -> PROXe lead.
    let leadId = prospect.lead_id
    let promoted = false
    let booking: (Booking & { lead_id: string }) | { error: string } | undefined
    // A day with no clock time ("Thursday") books 11 am that day: the demo
    // confirmation goes out with Confirmed / Reschedule so they can fix the
    // time themselves and the WhatsApp conversation starts (Z, 27 Oct 2026).
    const exact = ["callback", "interested"].includes(input.disposition) && !test
      ? parseCallbackTime(input.callbackRequest, input.occurredAt) : null
    const dayOnly = !exact && ["callback", "interested"].includes(input.disposition) && !test
      ? parseCallbackDay(input.callbackRequest, input.occurredAt) : null
    const slot = exact || (dayOnly ? { date: dayOnly.date, time: "11:00", at: new Date(Date.parse(`${dayOnly.date}T11:00:00+05:30`)).toISOString() } : null)
    if (slot && Date.parse(slot.at) > Date.now()) {
      booking = await bookInProxe(target, prospect.id, input, slot)
      if (!("error" in booking)) { leadId = booking.lead_id; promoted = !booking.duplicate }
    } else if (["interested", "callback"].includes(input.disposition) && !test && !prospect.promoted_at) {
      // Interested, or asked for a call back without a clock time: still a
      // PROXe lead, with a follow-up on the day they named (11 am IST, to be
      // confirmed) so it sits on the calendar (Z, 27 Oct 2026: "once the
      // lead is done, it should move").
      const day = parseCallbackDay(input.callbackRequest, input.occurredAt)
      leadId = await promote(target, prospect.id, input, day?.date || null)
      promoted = !!leadId
    }
    return { ok: true, prospect_id: prospect.id, activity: inserted?.length ? "inserted" : "exists", test, lead_id: leadId, promoted, ...(booking ? { booking } : {}) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function promote(target: Target, prospectId: string, input: MirrorInput, followUpDate: string | null = null): Promise<string | null> {
  const phoneKey = tail10(target.phone)
  if (phoneKey.length !== 10) return null
  const now = new Date().toISOString()
  const note = input.disposition === "callback"
    ? `Asked for a call back${followUpDate ? ` on ${followUpDate}` : ""}${input.callbackRequest ? ` ("${input.callbackRequest}")` : ""} on the AI intro call${input.conversationId ? ` (${input.conversationId})` : ""}. No time fixed: confirm the time.`
    : `Said interested on the AI intro call${input.conversationId ? ` (${input.conversationId})` : ""}. Needs a human follow-up to book the demo.`
  const outreach = {
    prospect_id: prospectId, contact_channel: "voice", external_system: "arc", external_id: target.id,
    source: target.source, organization: target.org, segment: target.segment, city: target.city,
    why_them: target.why_them, qualification_note: note, qualified_at: now, promoted_at: now,
    conversation_id: input.conversationId || null,
  }
  type Lead = { id: string; customer_name: string | null; unified_context: Record<string, unknown> | null }
  const matches = await px<Lead[]>(`all_leads?select=id,customer_name,unified_context&brand=eq.proxe&customer_phone_normalized=eq.${phoneKey}&limit=2`)
  if (matches.length > 1) return null // ambiguous: leave for a human, same rule as the dashboard promote route
  let leadId: string
  if (matches[0]) {
    const ctx = matches[0].unified_context || {}
    const prior = Array.isArray(ctx.lead_sources) ? (ctx.lead_sources as string[]) : []
    await px(`all_leads?id=eq.${matches[0].id}`, {
      method: "PATCH", body: JSON.stringify({
        unified_context: { ...ctx, outreach: { ...((ctx.outreach as object) || {}), ...outreach }, lead_sources: Array.from(new Set([...prior, "proxe_outbound"])) },
        last_touchpoint: "voice", last_interaction_at: now,
        ...(matches[0].customer_name ? {} : { customer_name: target.name }),
      }),
    })
    leadId = matches[0].id
  } else {
    const rows = await px<{ id: string }[]>("all_leads?select=id", {
      method: "POST", prefer: "return=representation",
      body: JSON.stringify({
        brand: "proxe", customer_name: target.name || target.org, email: target.email, phone: target.phone,
        customer_phone_normalized: phoneKey, first_touchpoint: "voice", last_touchpoint: "voice",
        last_interaction_at: input.occurredAt, lead_stage: "New",
        unified_context: { outreach, lead_sources: ["proxe_outbound"], attribution: { source: "proxe_outbound", source_label: "PROXe Outreach", original_source: target.source } },
      }),
    })
    leadId = rows[0].id
  }
  await px(`proxe_outbound_prospects?id=eq.${prospectId}`, {
    method: "PATCH", body: JSON.stringify({ status: "handed_off", qualified_at: now, qualification_note: note, lead_id: leadId, promoted_at: now, updated_at: now }),
  })
  await px("proxe_outbound_activity?on_conflict=brand,external_system,external_id", {
    method: "POST", prefer: "resolution=ignore-duplicates",
    body: JSON.stringify({ brand: "proxe", prospect_id: prospectId, external_system: "arc", external_id: `handoff:${prospectId}`, channel: "handoff", outcome: "handed_off", summary: `Interested on call. Moved to PROXe Leads as ${leadId}.`, occurred_at: now }),
  })
  await supabaseAdmin.from("outreach_targets").update({ proxe_lead_id: leadId, promoted_at: now, qualified_at: now, qualification_note: note }).eq("id", target.id)
  // The call itself as a note on the lead, so opening it shows what was said
  // (Z, 27 Oct 2026: "there should be a note based on what happened").
  const summary = input.body.match(/^SUMMARY: (.+)$/m)?.[1] || ""
  await px("activities", {
    method: "POST",
    body: JSON.stringify({
      lead_id: leadId, activity_type: "call", created_by: null,
      note: `[Connected] AI outbound call (${input.disposition.replace(/_/g, " ")}): ${summary || "see the recording"}${input.recordingUrl ? `
Recording: ${input.recordingUrl}` : ""}`,
    }),
  }).catch(() => null)
  // The day they named goes on PROXe's calendar as a follow-up (the store the
  // pipeline focus list and Telegram reminders read).
  const at = new Date(Date.parse(`${followUpDate || ""}T11:00:00+05:30`))
  if (followUpDate && Number.isFinite(at.getTime()) && at.getTime() > Date.now()) {
    await px("activities", {
      method: "POST",
      body: JSON.stringify({ lead_id: leadId, activity_type: "followup", note: `Call ${target.name || target.org || "them"} back - ${note}`, next_follow_up_date: at.toISOString(), created_by: null }),
    }).catch(() => null)
  }
  return leadId
}

/** "Glam 'N' Smile - Face, Hair & Dental Clinic" -> "Glam 'N' Smile": the brand, not the listing title. */
const shortOrg = (org: string | null) => (org || "").split(/\s+[-|–]\s+/)[0].trim() || null

async function bookInProxe(target: Target, prospectId: string, input: MirrorInput, slot: { date: string; time: string }): Promise<(Booking & { lead_id: string }) | { error: string }> {
  const base = process.env.PROXE_INTENT_BASE, key = process.env.PROXE_INBOUND_API_KEY
  if (!base || !key) return { error: "PROXE_INTENT_BASE / PROXE_INBOUND_API_KEY not set" }
  const name = input.contactName || contactNameFromTranscript(input.body) || target.name || target.org || "there"
  const summary = input.body.match(/^SUMMARY: (.+)$/m)?.[1] || ""
  try {
    const r = await fetch(base.replace(/\/$/, "") + "/api/agent/outreach/call-booking", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key }, cache: "no-store",
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        phone: target.phone, name, company: shortOrg(target.org), date: slot.date, time: slot.time,
        conversation_id: input.conversationId || `message:${input.messageId}`, source: "outbound_call",
        original_source: target.source, external_id: target.id, prospect_id: prospectId, summary,
        recording_url: input.recordingUrl || null,
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.lead_id) return { error: `PROXe call-booking ${r.status}: ${String(d.error || "").slice(0, 200)}` }
    const now = new Date().toISOString()
    const note = `Agreed a call on ${slot.date} ${slot.time} IST on the AI intro call${input.conversationId ? ` (${input.conversationId})` : ""}. Booked in PROXe.`
    await px(`proxe_outbound_prospects?id=eq.${prospectId}`, {
      method: "PATCH", body: JSON.stringify({ status: "handed_off", qualified_at: now, qualification_note: note, lead_id: d.lead_id, promoted_at: now, updated_at: now }),
    })
    await px("proxe_outbound_activity?on_conflict=brand,external_system,external_id", {
      method: "POST", prefer: "resolution=ignore-duplicates",
      body: JSON.stringify({ brand: "proxe", prospect_id: prospectId, external_system: "arc", external_id: `handoff:${prospectId}`, channel: "handoff", outcome: "handed_off", summary: `Booked ${slot.date} ${slot.time} IST. Moved to PROXe Leads as ${d.lead_id}.`, occurred_at: now }),
    })
    await supabaseAdmin.from("outreach_targets").update({ proxe_lead_id: d.lead_id, promoted_at: now, qualified_at: now, qualification_note: note }).eq("id", target.id)
    return { lead_id: d.lead_id, date: slot.date, time: slot.time, duplicate: !!d.duplicate, message: d.message || null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Re-mirror every ARC call message since `since`. Idempotent; used to catch up after an outage. */
export async function backfillCallsToProxe(since: string): Promise<{ scanned: number; mirrored: number; errors: string[] }> {
  const { data, error } = await supabaseAdmin.from("outreach_messages")
    .select("id,target_id,body,sent_at,provider_conversation_id").eq("channel", "call").gte("sent_at", since).order("sent_at").limit(500)
  if (error) return { scanned: 0, mirrored: 0, errors: [error.message] }
  const errors: string[] = []
  let mirrored = 0
  for (const m of data || []) {
    const body = String(m.body || "")
    const r = await mirrorCallToProxe({
      targetId: m.target_id, messageId: m.id, body, occurredAt: m.sent_at || new Date().toISOString(),
      disposition: body.match(/^DISPOSITION: (\S+)/m)?.[1] || "unknown",
      recordingUrl: body.match(/^RECORDING: (\S+)/m)?.[1] || null,
      callbackRequest: body.match(/^CALLBACK REQUEST \(pending review\): (.+)$/m)?.[1] || null,
      conversationId: m.provider_conversation_id,
    })
    if (r.ok) mirrored++
    else errors.push(`${m.id}: ${r.error}`)
  }
  return { scanned: (data || []).length, mirrored, errors }
}
