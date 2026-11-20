// Team dialer -> BCON PROXe (PROXE_DB_URL). SERVER ONLY.
//
// A human call lands on the PROXe lead in the same shapes the AI caller's calls
// use, so it plays and reads next to them on the lead and in Calls:
//   voice_sessions      one row, recording_url = ARC's keyed recording link
//   conversations       the call_summary row (+ one row per transcript turn)
//   activities          a manual_call row, "[Connected] <note>"
//   all_leads           the note appended to unified_context.admin_notes
// Every write is keyed on the ARC call id, so a retry never duplicates.
// brand "proxe": the AI caller's rows in this database carry it (checked 16 Nov).
const BRAND = "proxe"
import { createHash } from "crypto"

async function px<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const url = process.env.PROXE_DB_URL, key = process.env.PROXE_DB_SERVICE_KEY
  if (!url || !key) throw new Error("PROXe is not connected (PROXE_DB_URL / PROXE_DB_SERVICE_KEY).")
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

/** A stable uuid from a string, for conversation rows (same idea as PROXe's deterministic ids). */
function uuidFrom(s: string) {
  const h = createHash("sha256").update(s).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export type ProxeCall = {
  callId: string                // ARC dialer_calls.id
  leadId: string                // PROXe all_leads.id
  agentName: string             // who made the call
  phone: string
  customerName: string | null
  direction: "outbound" | "inbound"
  startedAt: string
  durationSecs: number
  outcome: "Connected" | "No Answer" | "Busy"
  note: string                  // the note a human would have typed
  summary: string
  transcript: { speaker: string; text: string; en?: string }[]
  recordingUrl: string | null
  fields: Record<string, unknown> | null
}

export async function pushCallToProxe(c: ProxeCall): Promise<void> {
  const sessionKey = `arc_dialer_${c.callId}`
  const transcriptText = c.transcript.map((t) => `${t.speaker}: ${t.text}${t.en ? `\n   (${t.en})` : ""}`).join("\n")

  // 1. voice_sessions: update-or-insert by hand (external_session_id has no unique index on live DBs).
  const existing = await px<{ id: string }[]>(`voice_sessions?select=id&external_session_id=eq.${sessionKey}&limit=1`)
  const session = {
    external_session_id: sessionKey,
    brand: BRAND,
    lead_id: c.leadId,
    customer_name: c.customerName,
    customer_phone: c.phone,
    customer_phone_normalized: c.phone.replace(/\D/g, "").slice(-10),
    call_duration_seconds: c.durationSecs,
    call_status: c.outcome === "Connected" ? "completed" : "no-answer",
    call_direction: c.direction,
    recording_url: c.recordingUrl,
    transcription: transcriptText || null,
    call_summary: c.summary || null,
    channel_data: { engine: "arc_dialer", kind: "human", agent_name: c.agentName, fields: c.fields },
    created_at: c.startedAt,
    updated_at: new Date().toISOString(),
  }
  if (existing[0]) await px(`voice_sessions?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify(session) })
  else await px("voice_sessions", { method: "POST", body: JSON.stringify(session) })

  // 2. conversations: the transcript turns and the summary row with the recording.
  const start = Date.parse(c.startedAt)
  const rows = c.transcript.slice(0, 400).map((t, i) => ({
    id: uuidFrom(`${sessionKey}:turn:${i}`),
    brand: BRAND,
    lead_id: c.leadId,
    channel: "voice",
    sender: t.speaker === "Customer" ? "customer" : "agent",
    content: t.text.slice(0, 4000),
    message_type: "text",
    // content_en: the call screen in PROXe shows English without another translation.
    metadata: { call_id: sessionKey, source: "arc_dialer", engine: "arc_dialer", human: true, agent_name: c.agentName, turn: i, ...(t.en ? { content_en: t.en } : {}) },
    created_at: new Date(start + i * 1000).toISOString(),
  }))
  rows.push({
    id: uuidFrom(`${sessionKey}:summary`),
    brand: BRAND,
    lead_id: c.leadId,
    channel: "voice",
    sender: "agent",
    content: c.summary || c.note || "(call completed)",
    message_type: "call_summary",
    metadata: {
      call_id: sessionKey, source: "arc_dialer", engine: "arc_dialer", human: true, agent_name: c.agentName,
      summary: true, recording_url: c.recordingUrl, duration_seconds: c.durationSecs, outcome: c.outcome,
    } as never,
    created_at: new Date(start + c.durationSecs * 1000).toISOString(),
  })
  await px("conversations?on_conflict=id", { method: "POST", prefer: "resolution=ignore-duplicates", body: JSON.stringify(rows) })

  // A lead with no name takes the name said on the call (a short first call may have had none).
  const heardName = typeof c.fields?.contact_name === "string" ? c.fields.contact_name.trim() : ""
  if (heardName) {
    await px(`all_leads?id=eq.${c.leadId}&customer_name=is.null`, { method: "PATCH", body: JSON.stringify({ customer_name: heardName.slice(0, 120) }) }).catch(() => null)
  }

  // 3. activities + 4. admin note, once per call (the activity note carries the call key).
  const marker = `[arc:${c.callId.slice(0, 8)}]`
  const activityNote = `[${c.outcome}] ${c.note} ${marker}`.trim()
  const seen = await px<{ id: string }[]>(
    `activities?select=id&lead_id=eq.${c.leadId}&note=like.${encodeURIComponent("*" + marker + "*")}&limit=1`,
  ).catch(() => [])
  if (!seen.length) {
    await px("activities", {
      method: "POST",
      body: JSON.stringify({ lead_id: c.leadId, activity_type: "manual_call", note: activityNote.slice(0, 4000), created_by: `${c.agentName} (ARC dialer)` }),
    })
    const lead = await px<{ unified_context: Record<string, unknown> | null }[]>(`all_leads?select=unified_context&id=eq.${c.leadId}`)
    const ctx = (lead[0]?.unified_context && typeof lead[0].unified_context === "object" ? lead[0].unified_context : {}) as Record<string, unknown>
    const notes = Array.isArray(ctx.admin_notes) ? ctx.admin_notes : []
    await px(`all_leads?id=eq.${c.leadId}`, {
      method: "PATCH",
      body: JSON.stringify({
        unified_context: {
          ...ctx,
          admin_notes: [...notes, {
            id: `call_arc_${c.callId}`,
            text: `Call logged - ${c.outcome}: ${c.note}`,
            created_by: c.agentName,
            created_at: new Date().toISOString(),
            source: "log_call",
            outcome: c.outcome,
            recording_url: c.recordingUrl,
          }],
        },
      }),
    })
  }
}

/** Whether this PROXe lead still exists (a lead can be deleted after ARC linked it). */
export async function proxeLeadExists(id: string): Promise<boolean> {
  const rows = await px<{ id: string }[]>(`all_leads?select=id&id=eq.${encodeURIComponent(id)}&limit=1`).catch(() => null)
  return rows === null ? true : rows.length > 0 // on a read error, keep the link and let the write report it
}

/** A new PROXe lead for a number the team called that PROXe did not have yet. Returns its id. */
export async function createProxeLead(p: { phone: string; name: string | null; business: string | null; at: string }): Promise<string | null> {
  const tail = String(p.phone || "").replace(/\D/g, "").slice(-10)
  if (tail.length !== 10) return null
  const rows = await px<{ id: string }[]>("all_leads?select=id", {
    method: "POST", prefer: "return=representation",
    body: JSON.stringify({
      brand: BRAND, customer_name: p.name || p.business || null, phone: p.phone, customer_phone_normalized: tail,
      first_touchpoint: "voice", last_touchpoint: "voice", last_interaction_at: p.at, lead_stage: "New",
      unified_context: { lead_sources: ["team_call"], attribution: { source: "team_call", source_label: "Team call" }, ...(p.business ? { company: p.business } : {}) },
    }),
  })
  return rows[0]?.id || null
}

export type ProxeLead = {
  id: string; name: string | null; company: string | null; phone: string | null; email: string | null
  stage: string | null; temperature: string | null; score: number | null; status: string | null
  source: string | null; last_interaction_at: string | null; booking: string | null
  summary: string | null; notes: { text: string; at: string | null }[]
}

/** The PROXe lead with this phone number (newest when there are several), with what PROXe knows about it. */
export async function proxeLeadByPhone(phone: string | null | undefined): Promise<ProxeLead | null> {
  const tail = String(phone || "").replace(/\D/g, "").slice(-10)
  if (tail.length !== 10 || !process.env.PROXE_DB_URL || !process.env.PROXE_DB_SERVICE_KEY) return null
  type Row = {
    id: string; customer_name: string | null; phone: string | null; email: string | null; lead_stage: string | null; lead_score: number | null
    status: string | null; first_touchpoint: string | null; last_interaction_at: string | null; booking_date: string | null; booking_time: string | null
    unified_context: Record<string, unknown> | null
  }
  const rows = await px<Row[]>(
    `all_leads?select=id,customer_name,phone,email,lead_stage,lead_score,status,first_touchpoint,last_interaction_at,booking_date,booking_time,unified_context` +
    `&or=(customer_phone_normalized.eq.${tail},phone.like.*${tail})&order=last_interaction_at.desc.nullslast&limit=1`,
  ).catch(() => [] as Row[])
  const r = rows[0]
  if (!r) return null
  const uc = r.unified_context || {}
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  const notes = (Array.isArray(uc.admin_notes) ? uc.admin_notes : []) as { text?: string; created_at?: string; at?: string }[]
  return {
    id: r.id, name: str(r.customer_name), company: str(uc.company), phone: r.phone, email: str(r.email),
    stage: str(r.lead_stage), temperature: str(uc.lead_temperature), score: r.lead_score, status: str(r.status),
    source: str(r.first_touchpoint), last_interaction_at: r.last_interaction_at,
    booking: r.booking_date ? [r.booking_date, r.booking_time].filter(Boolean).join(" ") : null,
    summary: str(uc.unified_summary)?.slice(0, 900) || null,
    notes: notes.filter((n) => str(n?.text)).slice(-3).reverse().map((n) => ({ text: String(n.text).slice(0, 300), at: str(n.created_at) || str(n.at) })),
  }
}
