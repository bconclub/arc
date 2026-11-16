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
  transcript: { speaker: string; text: string }[]
  recordingUrl: string | null
  fields: Record<string, unknown> | null
}

export async function pushCallToProxe(c: ProxeCall): Promise<void> {
  const sessionKey = `arc_dialer_${c.callId}`
  const transcriptText = c.transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n")

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
    metadata: { call_id: sessionKey, source: "arc_dialer", engine: "arc_dialer", human: true, agent_name: c.agentName, turn: i },
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
