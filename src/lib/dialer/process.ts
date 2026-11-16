// After a lead call ends: keep the recording, write the note, file it. SERVER ONLY.
//
//   1. recording  Vobiz file -> ARC's private R2 (dialer/<call id>.mp3). If the
//                 RecordStop callback never came, the Recording API is asked.
//   2. transcript ElevenLabs speech-to-text with speakers.
//   3. note       Claude reads the transcript: outcome, a short note, and the
//                 business details either side said (need, volume, budget...).
//   4. file it    ARC lead activity, and the PROXe lead (inbound leads directly,
//                 outbound prospects through the existing PROXe mirror).
// Safe to run again: each step skips what is already done, and a lock stops two
// runs at once.
import { supabaseAdmin } from "@/lib/supabase"
import { r2Configured, r2Presign } from "@/lib/r2"
import { callAI } from "@/lib/ai-client"
import { mirrorCallToProxe } from "@/lib/proxe-outbound-mirror"
import { downloadRecording, findRecording } from "./vobiz"
import { recordingLink } from "./config"
import { pushCallToProxe } from "./proxe"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

export type DialerCall = {
  id: string; member_id: string | null; session_id: string | null; target_id: string | null; proxe_lead_id: string | null
  direction: "outbound" | "inbound"; phone: string; caller_id: string | null; request_uuid: string | null; call_uuid: string | null
  status: "dialing" | "connected" | "ended" | "no_answer" | "failed"; hangup_cause: string | null
  started_at: string; answered_at: string | null; ended_at: string | null; duration_secs: number | null
  recording_id: string | null; recording_src: string | null; recording_key: string | null
  recording_status: "pending" | "saved" | "missing" | "none"
  transcript: string | null; note: string | null; fields: Record<string, unknown> | null; outcome: string | null
  processing_at: string | null; processed_at: string | null; proxe_synced_at: string | null; proxe_error: string | null; error: string | null
}

/** A connected call waits this long for its recording before it is filed as missing. */
const RECORDING_WAIT_MS = 30 * 60_000

type Turn = { speaker: string; text: string }
type Note = {
  outcome: "connected" | "callback" | "interested" | "not_interested" | "wrong_number"
  summary: string
  note: string
  keenness: "keen" | "lukewarm" | "not" | null
  fields: Record<string, string>
}

async function saveRecording(call: DialerCall): Promise<DialerCall> {
  if (call.recording_key || !call.call_uuid) return call
  let src = call.recording_src, recId = call.recording_id
  if (!src) {
    const found = await findRecording(call.call_uuid).catch(() => null)
    if (found) { src = found.url; recId = found.id || recId }
  }
  if (!src) return call
  if (!r2Configured()) throw new Error("R2 is not configured; the recording stays on Vobiz for now.")
  const file = await downloadRecording(src)
  const key = `dialer/${call.id}.${file.type === "audio/wav" ? "wav" : "mp3"}`
  const put = await fetch(r2Presign(key, { method: "PUT", expires: 600 }), {
    method: "PUT", body: new Uint8Array(file.bytes), headers: { "Content-Type": file.type },
  })
  if (!put.ok) throw new Error(`R2 upload ${put.status}`)
  const patch = { recording_src: src, recording_id: recId, recording_key: key, recording_status: "saved" }
  await db.from("dialer_calls").update(patch).eq("id", call.id)
  return { ...call, ...patch } as DialerCall
}

async function transcribe(call: DialerCall): Promise<Turn[]> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key || !call.recording_key) return []
  const audio = await fetch(r2Presign(call.recording_key, { expires: 600 }), { cache: "no-store" })
  if (!audio.ok) throw new Error(`Recording read ${audio.status}`)
  const form = new FormData()
  form.append("model_id", "scribe_v1")
  form.append("diarize", "true")
  form.append("tag_audio_events", "false")
  form.append("file", new Blob([await audio.arrayBuffer()], { type: "audio/mpeg" }), "call.mp3")
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(180000),
  })
  if (!r.ok) throw new Error(`Transcription ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const d = (await r.json()) as { text?: string; words?: { text: string; type?: string; speaker_id?: string }[] }
  const turns: { speaker: string; text: string }[] = []
  for (const w of d.words || []) {
    if (w.type && w.type !== "word" && w.type !== "spacing") continue
    const sp = w.speaker_id || "speaker_0"
    const last = turns[turns.length - 1]
    if (last && last.speaker === sp) last.text += w.text
    else if (w.type !== "spacing") turns.push({ speaker: sp, text: w.text })
  }
  const clean = turns.map((t) => ({ speaker: t.speaker, text: t.text.replace(/\s+/g, " ").trim() })).filter((t) => t.text)
  return clean.length ? clean : d.text ? [{ speaker: "speaker_0", text: d.text.trim() }] : []
}

const FIELD_KEYS = ["business", "contact_name", "role", "need", "lead_sources", "lead_volume", "current_setup", "team_size", "budget", "decision_maker", "timeline", "objections", "next_step", "callback_when"]

async function writeNote(turns: Turn[], ctx: { agent: string; lead: string }): Promise<{ note: Note; labelled: Turn[] }> {
  const raw = await callAI({
    max_tokens: 1500,
    systemPrompt: [
      "You read a recorded sales call. A BCON/PROXe salesperson called a business lead. PROXe is an AI lead-management product.",
      "The transcript has anonymous speaker ids. The salesperson introduces themselves or PROXe; the other speaker is the customer.",
      "Reply with ONE JSON object, nothing else:",
      '{"agent_speaker": "<speaker id of the salesperson>",',
      ' "outcome": "connected" | "callback" | "interested" | "not_interested" | "wrong_number",',
      ' "summary": "2-3 plain sentences: what was discussed and agreed",',
      ' "note": "the note the salesperson would log: what they want, the next step and when",',
      ' "keenness": "keen" | "lukewarm" | "not" | null,',
      ` "fields": { ${FIELD_KEYS.map((k) => `"${k}": ""`).join(", ")} } }`,
      "Fill a field only with what someone actually said (either side). Leave it empty otherwise. Never guess.",
      "interested = they want a demo, pricing or to go ahead. callback = they asked to be called at another time.",
      "Keep the customer's own words for numbers, prices and times. Use ₹ for rupees.",
    ].join("\n"),
    userMessage: `Salesperson: ${ctx.agent}\nLead on file: ${ctx.lead}\n\nTranscript:\n${turns.map((t) => `${t.speaker}: ${t.text}`).join("\n").slice(0, 60000)}`,
  })
  const m = raw.match(/\{[\s\S]*\}/)
  const j = m ? JSON.parse(m[0]) : {}
  const outcomes = ["connected", "callback", "interested", "not_interested", "wrong_number"]
  const fields: Record<string, string> = {}
  for (const k of FIELD_KEYS) if (typeof j.fields?.[k] === "string" && j.fields[k].trim()) fields[k] = j.fields[k].trim().slice(0, 500)
  const agentSpeaker = typeof j.agent_speaker === "string" ? j.agent_speaker : ""
  return {
    note: {
      outcome: outcomes.includes(j.outcome) ? j.outcome : "connected",
      summary: String(j.summary || "").slice(0, 2000),
      note: String(j.note || j.summary || "").slice(0, 3000),
      keenness: ["keen", "lukewarm", "not"].includes(j.keenness) ? j.keenness : null,
      fields,
    },
    labelled: turns.map((t) => ({ speaker: agentSpeaker && t.speaker === agentSpeaker ? ctx.agent : "Customer", text: t.text })),
  }
}

const DISPOSITION_STAGE: Record<string, string> = {
  interested: "replied", callback: "replied", not_interested: "lost", wrong_number: "lost", no_answer: "no_reply",
}
const DEMOTABLE = ["identified", "researched", "drafted", "sent", "no_reply"]

/**
 * File one call. Returns the row as it now stands. `force` skips the wait for a
 * recording (used once the wait is over: the call is filed as recording missing).
 */
export async function processCall(id: string, opts: { force?: boolean } = {}): Promise<DialerCall | null> {
  const { data: row } = await db.from("dialer_calls").select("*").eq("id", id).maybeSingle()
  let call = row as DialerCall | null
  if (!call || call.processed_at) return call
  if (!["ended", "no_answer", "failed"].includes(call.status)) return call

  // Lock: one run at a time; a run that died over 5 minutes ago can be taken over.
  const stale = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data: locked } = await db.from("dialer_calls").update({ processing_at: new Date().toISOString() })
    .eq("id", id).is("processed_at", null).or(`processing_at.is.null,processing_at.lt.${stale}`).select("id")
  if (!locked?.length) return call

  try {
    const connected = call.status === "ended" && (call.duration_secs ?? 0) > 0
    const { data: member } = call.member_id
      ? await db.from("team_members").select("name,username").eq("id", call.member_id).maybeSingle()
      : { data: null }
    const agentName: string = member?.name || "BCON sales"
    const worker: string = member?.username || "manual"
    const { data: target } = call.target_id
      ? await db.from("outreach_targets").select("id,name,org,status,phone,proxe_lead_id,source").eq("id", call.target_id).maybeSingle()
      : { data: null }

    let turns: Turn[] = []
    let note: Note | null = null
    if (connected) {
      call = await saveRecording(call)
      const waited = Date.now() - Date.parse(call.ended_at || call.started_at)
      if (!call.recording_key) {
        if (!opts.force && waited < RECORDING_WAIT_MS) {
          await db.from("dialer_calls").update({ processing_at: null }).eq("id", id)
          return call // the RecordStop callback or the sweep will run this again
        }
        await db.from("dialer_calls").update({ recording_status: "missing" }).eq("id", id)
        call.recording_status = "missing"
      } else {
        const heard = await transcribe(call)
        if (heard.length) {
          const written = await writeNote(heard, { agent: agentName, lead: [target?.name, target?.org].filter(Boolean).join(", ") || call.phone })
          note = written.note
          turns = written.labelled
        }
      }
    } else if (call.recording_status === "pending") {
      await db.from("dialer_calls").update({ recording_status: "none" }).eq("id", id)
      call.recording_status = "none"
    }

    const outcome = !connected ? "no_answer" : note?.outcome || "connected"
    const recUrl = call.recording_key ? recordingLink(call.id) : null
    const noteText = !connected
      ? `No answer (${(call.hangup_cause || "not picked up").toLowerCase().replace(/_/g, " ")}).`
      : note?.note || (call.recording_status === "missing" ? "Connected. Recording missing: log what was said by hand." : "Connected. No transcript.")
    const detail = note && Object.keys(note.fields).length
      ? "\n" + Object.entries(note.fields).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n")
      : ""
    const lines = [
      `${call.direction === "inbound" ? "Inbound call" : "Call"} by ${agentName} from ${call.caller_id || "company number"}, ${call.duration_secs ?? 0}s.`,
      noteText + detail,
      recUrl && `RECORDING: ${recUrl}`,
      turns.length ? `TRANSCRIPT:\n${turns.map((t) => `${t.speaker}: ${t.text}`).join("\n")}` : "",
    ].filter(Boolean).join("\n")

    await db.from("dialer_calls").update({
      transcript: turns.length ? JSON.stringify(turns) : null,
      note: noteText, fields: note?.fields || null, outcome,
    }).eq("id", id)

    // ARC: the lead's activity (shows on the lead panel), keyed on the call.
    if (target) {
      await db.from("outreach_activity").upsert({
        target_id: target.id, channel: "call", outcome, worker, external_id: `dialer:${call.id}`,
        occurred_at: call.started_at, summary: lines.slice(0, 20000), evidence_url: recUrl, next_at: null,
      }, { onConflict: "worker,external_id", ignoreDuplicates: true })
      const stage = DISPOSITION_STAGE[outcome]
      if (stage && DEMOTABLE.includes(target.status)) await db.from("outreach_targets").update({ status: stage }).eq("id", target.id)
    }

    // PROXe.
    let proxeError: string | null = null
    try {
      const leadId = call.proxe_lead_id || target?.proxe_lead_id || null
      if (leadId) {
        await pushCallToProxe({
          callId: call.id, leadId, agentName, phone: call.phone, customerName: target?.name || null,
          direction: call.direction, startedAt: call.answered_at || call.started_at, durationSecs: call.duration_secs ?? 0,
          outcome: connected ? "Connected" : /busy/i.test(call.hangup_cause || "") ? "Busy" : "No Answer",
          note: noteText + detail.replace(/\n/g, "; "), summary: note?.summary || noteText, transcript: turns, recordingUrl: recUrl,
          fields: note ? { ...note.fields, keenness: note.keenness } : null,
        })
      } else if (target) {
        // Outbound prospect: the existing mirror (proxe_outbound_*, interested -> all_leads).
        // No callback request is passed, so it never books a slot or sends a WhatsApp.
        const { data: msg } = await db.from("outreach_messages").insert({
          target_id: target.id, direction: "out", channel: "call", body: lines.slice(0, 20000), sent_at: call.started_at,
        }).select("id").single()
        if (msg?.id) {
          const res = await mirrorCallToProxe({
            targetId: target.id, messageId: msg.id, disposition: outcome, body: lines, occurredAt: call.started_at,
            recordingUrl: recUrl, agentId: `arc_dialer:${worker}`, callbackRequest: null,
            contactName: note?.fields.contact_name || null,
          })
          if (!res.ok) proxeError = res.error
        }
      } else {
        proxeError = "No lead matched this number."
      }
    } catch (e) {
      proxeError = (e as Error).message.slice(0, 500)
    }

    const done = { processed_at: new Date().toISOString(), processing_at: null, proxe_error: proxeError, proxe_synced_at: proxeError ? null : new Date().toISOString(), error: null }
    await db.from("dialer_calls").update(done).eq("id", id)
    return { ...call, ...done, outcome, note: noteText } as DialerCall
  } catch (e) {
    await db.from("dialer_calls").update({ processing_at: null, error: (e as Error).message.slice(0, 500) }).eq("id", id)
    throw e
  }
}

/**
 * The backstop, run whenever a team page asks for dialer state: calls that ended
 * without being filed (a lost callback, a crashed run) are retried, and a call
 * that has waited 30 minutes for its recording is filed as recording missing.
 */
export async function sweep(limit = 3): Promise<void> {
  const before = new Date(Date.now() - 2 * 60_000).toISOString()
  const { data } = await db.from("dialer_calls").select("id,ended_at")
    .is("processed_at", null).in("status", ["ended", "no_answer", "failed"]).lt("ended_at", before)
    .order("ended_at").limit(limit)
  for (const c of (data || []) as { id: string; ended_at: string }[]) {
    const force = Date.now() - Date.parse(c.ended_at) > RECORDING_WAIT_MS
    await processCall(c.id, { force }).catch((e) => console.error("[dialer] sweep", c.id, (e as Error).message))
  }
  // Calls stuck "dialing"/"connected" for 3 hours never sent a hang-up: close them.
  const old = new Date(Date.now() - 3 * 3600e3).toISOString()
  await db.from("dialer_calls").update({ status: "failed", hangup_cause: "NO_HANGUP_EVENT", ended_at: new Date().toISOString() })
    .in("status", ["dialing", "connected"]).lt("started_at", old)
}
