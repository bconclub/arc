// The live side of a call: what is being said right now, and which guide
// questions it has already answered. SERVER ONLY.
//
// Vobiz streams the call's audio to the dialer-stream relay (a Supabase edge
// function), which posts it here a few seconds at a time, one voice per track.
// Each piece is transcribed (ElevenLabs) and kept as a row in dialer_settings
// (key live:<call>:<seq>:<track>), so two pieces landing together never clash.
// Every ~25 seconds a small model reads the transcript so far and marks the
// questions the customer has answered (key livecheck:<call>).
import { db } from "./members"
import { getGuide } from "./guide"

export type LiveLine = { who: "caller" | "lead"; text: string; at: string }
export type LiveCheck = { covered: Record<string, string>; at: string }

const CHECK_EVERY_MS = 25_000
/** Below this the piece is line noise or silence: not worth transcribing. */
const QUIET_RMS = 180

/** 16-bit PCM arrives in one of two byte orders; speech is smoother in the right one. */
function toLittleEndian(pcm: Buffer): { le: Buffer; rms: number } {
  const n = Math.floor(pcm.length / 2)
  let roughLE = 0, roughBE = 0, pl = 0, pb = 0
  const step = Math.max(1, Math.floor(n / 4000))
  for (let i = 0; i < n; i += step) {
    const l = pcm.readInt16LE(i * 2), b = pcm.readInt16BE(i * 2)
    roughLE += Math.abs(l - pl); roughBE += Math.abs(b - pb)
    pl = l; pb = b
  }
  const le = Buffer.from(pcm.subarray(0, n * 2))
  if (roughBE < roughLE) le.swap16()
  let sum = 0
  for (let i = 0; i < n; i++) { const s = le.readInt16LE(i * 2); sum += s * s }
  return { le, rms: n ? Math.sqrt(sum / n) : 0 }
}

function wav(pcm: Buffer, rate = 8000): Buffer {
  const h = Buffer.alloc(44)
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

async function hear(pcmLE: Buffer): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return ""
  const form = new FormData()
  form.append("model_id", "scribe_v1")
  form.append("tag_audio_events", "false")
  form.append("file", new Blob([new Uint8Array(wav(pcmLE))], { type: "audio/wav" }), "piece.wav")
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) throw new Error(`Transcription ${r.status}`)
  const d = (await r.json()) as { text?: string }
  return String(d.text || "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim()
}

export async function liveLines(callId: string): Promise<LiveLine[]> {
  const { data } = await db.from("dialer_settings").select("key,value").like("key", `live:${callId}:%`).order("key").limit(2000)
  return ((data || []) as { value: LiveLine }[]).map((r) => r.value).filter((v) => v?.text)
}

export async function liveCheck(callId: string): Promise<LiveCheck | null> {
  const { data } = await db.from("dialer_settings").select("value").eq("key", `livecheck:${callId}`).maybeSingle()
  return (data?.value as LiveCheck) || null
}

/** Which guide questions the customer has answered so far. Once answered, stays answered. */
async function check(callId: string): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return
  const prev = await liveCheck(callId)
  if (prev && Date.now() - Date.parse(prev.at) < CHECK_EVERY_MS) return
  const covered = { ...(prev?.covered || {}) }
  // Claim the slot first, so pieces landing together do not all run the check.
  const claim = () => db.from("dialer_settings").upsert({ key: `livecheck:${callId}`, value: { covered, at: new Date().toISOString() }, updated_at: new Date().toISOString() })
  await claim()
  const [lines, guide] = await Promise.all([liveLines(callId), getGuide()])
  const open = guide.map((q, i) => ({ q, i })).filter((x) => covered[String(x.i)] === undefined)
  if (!lines.length || !open.length) return
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: [
        "A salesperson is on a live sales call. You see the rough live transcript so far (it may mix English with Indian languages and contain mishearings).",
        "For each numbered QUESTION, decide if the CUSTOMER has already given an answer, even if the salesperson asked it in other words.",
        'Reply with ONE JSON object and nothing else: {"<question number>": "<the customer\'s answer in under 12 words>"}. Include only questions that are answered. {} if none.',
      ].join("\n"),
      messages: [{
        role: "user",
        content: `QUESTIONS:\n${open.map((x) => `${x.i + 1}. ${x.q}`).join("\n")}\n\nTRANSCRIPT:\n${lines.map((l) => `${l.who === "lead" ? "Customer" : "Salesperson"}: ${l.text}`).join("\n").slice(-12000)}`,
      }],
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) return
  const j = (await r.json()) as { content?: { type: string; text?: string }[] }
  const m = (j.content?.[0]?.text || "").match(/\{[\s\S]*\}/)
  if (!m) return
  let got: Record<string, unknown> = {}
  try { got = JSON.parse(m[0]) } catch { return }
  for (const [n, a] of Object.entries(got)) {
    const i = Number(n) - 1
    if (Number.isInteger(i) && i >= 0 && i < guide.length && typeof a === "string" && a.trim()) covered[String(i)] = a.trim().slice(0, 160)
  }
  await claim()
}

/** One piece of one voice. Returns what was heard ("" when it was silence). */
export async function takePiece(callId: string, track: string, seq: number, pcm: Buffer): Promise<string> {
  const { le, rms } = toLittleEndian(pcm)
  if (le.length < 8000 || rms < QUIET_RMS) return ""
  const text = await hear(le)
  if (text) {
    // On the lead's leg, "inbound" is the lead speaking; "outbound" is what they hear: our caller.
    const line: LiveLine = { who: track === "inbound" ? "lead" : "caller", text, at: new Date().toISOString() }
    await db.from("dialer_settings").upsert({
      key: `live:${callId}:${String(seq).padStart(6, "0")}:${track === "inbound" ? "b" : "a"}`, value: line, updated_at: new Date().toISOString(),
    })
    await check(callId).catch(() => null)
  }
  return text
}

/** Live rows are only for the screen during the call; the filed transcript comes from the recording. */
export async function clearOldLive(): Promise<void> {
  const old = new Date(Date.now() - 2 * 86400e3).toISOString()
  await db.from("dialer_settings").delete().like("key", "live%:%").lt("updated_at", old)
}
