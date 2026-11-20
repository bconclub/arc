// The live side of a call: what is being said right now, and which guide
// questions it has already answered. SERVER ONLY.
//
// Vobiz streams the call's audio to the dialer-stream relay (a Supabase edge
// function), which posts it here a few seconds at a time, one voice per track.
// Each piece is transcribed (ElevenLabs) and kept as a row in dialer_settings
// (key live:<call>:<seq>:<track>), so two pieces landing together never clash.
// Speech in any language is heard as it is (ElevenLabs finds the language
// itself: English, Hindi, Kannada, Tamil, Telugu, Malayalam and ~90 more);
// anything not in English also gets an English line under it.
// Every ~12 seconds a small model reads the transcript so far, marks the
// questions the customer has answered and scores the lead live: how much
// they want it solved (intent), what they have committed to on this call
// (commitment), how they see us (value provider, problem solver, painkiller)
// and their loss in rupees from their own numbers. The scoring follows the
// PROXe pain model (docs/gtm/learning/axlrate-gtm/pain-model.md). Key
// livecheck:<call>.
import { db } from "./members"
import { getGuide } from "./guide"
import { proxeLeadByPhone } from "./proxe"

export type LiveLine = { who: "caller" | "lead"; text: string; at: string; lang?: string; en?: string }
export type LiveScore = {
  intent: number; commitment: number; stage: "value" | "problem" | "pain"
  loss: string; why: string; next: string
}
export type LiveCheck = { covered: Record<string, string>; score?: LiveScore; at: string }

const CHECK_EVERY_MS = 12_000
const HAIKU = "claude-haiku-4-5"
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

type Heard = { text: string; lang: string; sure: number }

async function hear(pcmLE: Buffer): Promise<Heard> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return { text: "", lang: "", sure: 0 }
  const form = new FormData()
  form.append("model_id", "scribe_v1")
  form.append("tag_audio_events", "false")
  form.append("file", new Blob([new Uint8Array(wav(pcmLE))], { type: "audio/wav" }), "piece.wav")
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) throw new Error(`Transcription ${r.status}`)
  const d = (await r.json()) as { text?: string; language_code?: string; language_probability?: number }
  return {
    text: String(d.text || "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim(),
    lang: String(d.language_code || ""), sure: Number(d.language_probability) || 0,
  }
}

const isEnglish = (lang: string) => !lang || lang.startsWith("en")

async function haiku(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return ""
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: HAIKU, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) return ""
  const j = (await r.json()) as { content?: { type: string; text?: string }[] }
  return (j.content?.[0]?.text || "").trim()
}

/** One line of an Indian-language (or mixed) phone call, in plain English. */
function toEnglish(text: string): Promise<string> {
  return haiku(
    "Translate this line from a sales phone call in India into plain, natural English. It may mix English with Hindi, Kannada, Tamil, Telugu, Malayalam or another language, and may contain mishearings. Keep numbers, names and rupee amounts exactly. Reply with the English line only.",
    text, 200,
  ).catch(() => "")
}

const names = new Map<string, { agent: string; lead: string; known: boolean }>()
/** Who is on this call: the teammate, and the customer as PROXe or ARC knows them. Cached per call. */
async function callNames(callId: string): Promise<{ agent: string; lead: string; known: boolean }> {
  const hit = names.get(callId)
  if (hit) return hit
  const { data: call } = await db.from("dialer_calls").select("member_id,target_id,phone").eq("id", callId).maybeSingle()
  const [{ data: member }, { data: target }, lead] = await Promise.all([
    call?.member_id ? db.from("team_members").select("name").eq("id", call.member_id).maybeSingle() : Promise.resolve({ data: null }),
    call?.target_id ? db.from("outreach_targets").select("name").eq("id", call.target_id).maybeSingle() : Promise.resolve({ data: null }),
    call?.phone ? proxeLeadByPhone(call.phone).catch(() => null) : Promise.resolve(null),
  ])
  const leadName = (target as { name?: string } | null)?.name || lead?.name || null
  const out = { agent: (member as { name?: string } | null)?.name || "Salesperson", lead: leadName || "Customer", known: !!leadName }
  names.set(callId, out)
  return out
}

export async function liveLines(callId: string): Promise<LiveLine[]> {
  const { data } = await db.from("dialer_settings").select("key,value").like("key", `live:${callId}:%`).order("key").limit(2000)
  return ((data || []) as { value: LiveLine }[]).map((r) => r.value).filter((v) => v?.text)
}

export async function liveCheck(callId: string): Promise<LiveCheck | null> {
  const { data } = await db.from("dialer_settings").select("value").eq("key", `livecheck:${callId}`).maybeSingle()
  const v = (data?.value as LiveCheck) || null
  if (!v) return null
  // A question ticked with "Not answered" is still open: drop it, so the check asks again.
  const covered = Object.fromEntries(Object.entries(v.covered || {}).filter(([, a]) => typeof a === "string" && a.trim() && !NOT_AN_ANSWER.test(a.trim())))
  return { ...v, covered }
}

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))

const SCORE_RULES = [
  "A PROXe salesperson is on a live sales call with a business owner in India. PROXe answers and follows up every lead for a business, day and night.",
  "You see the rough live transcript so far (translated where needed; it may contain mishearings).",
  "1. For each numbered OPEN QUESTION, decide if the CUSTOMER has already answered it, even if it was asked in other words.",
  "2. Score the customer right now, from what they said and did on this call only:",
  "- intent 0-100: how badly they want this problem solved now. High when they name their own loss, ask how fast it can start, ask about price or setup. Low when they say 'send details', 'after Diwali', 'not now', or only listen.",
  "- commitment 0-100: what they have actually committed to on this call. Actions count, words mostly do not. Giving real numbers, agreeing a next call with a day and time, bringing in the decision maker, asking for a proposal raise it a little; asking for an invoice, GST or bank details, or agreeing to pay raise it a lot. 'Sounds good' alone is words: keep it low.",
  '- stage: how they see us. "value" = nice to have, no urgency. "problem" = this could fix something for them, some interest. "pain" = they feel they are losing money now and want it fast.',
  '- loss: their loss in rupees using ONLY numbers the customer said (leads a day x share missed x share that buy x value of one customer), like "₹40,000 a day". Empty string if they have not given enough numbers. Never invent a number.',
  "- why: under 15 words, the reason for the score.",
  "- next: under 12 words, the single most useful thing for the salesperson to ask or do next.",
].join("\n")
/** The model sometimes fills an open question with "Not answered": that is not an answer (Z, 20 Nov 2026: 9 of 9 "answered", every one "Not answered"). */
const NOT_AN_ANSWER = /^(not (yet )?(answered|asked|mentioned|discussed|covered|said|given|known|clear)|no answer|none|n\/?a|unknown|unanswered|-+|\?+)\.?$/i
const SCORE_SHAPE = 'Reply with ONE JSON object, nothing else: {"answers": {"<question number>": "<the customer\'s answer in under 12 words>"} (only questions the customer has actually answered; leave the rest out),"intent": 0, "commitment": 0, "stage": "value", "loss": "", "why": "", "next": ""}'

/**
 * Which guide questions the customer has answered so far (once answered,
 * stays answered), and the live score.
 */
async function check(callId: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return
  const prev = await liveCheck(callId)
  if (prev && Date.now() - Date.parse(prev.at) < CHECK_EVERY_MS) return
  const covered = { ...(prev?.covered || {}) }
  let score = prev?.score
  // Claim the slot first, so pieces landing together do not all run the check.
  const save = () => db.from("dialer_settings").upsert({ key: `livecheck:${callId}`, value: { covered, score, at: new Date().toISOString() }, updated_at: new Date().toISOString() })
  await save()
  const [lines, guide] = await Promise.all([liveLines(callId), getGuide()])
  if (!lines.length) return
  const open = guide.map((q, i) => ({ q, i })).filter((x) => covered[String(x.i)] === undefined)
  // Real names, so "next" reads "Ask Ravi..." and not "Ask the customer" (Z, 20 Nov 2026).
  const who = await callNames(callId)
  const said = lines.map((l) => `${l.who === "lead" ? who.lead : who.agent}: ${l.en || l.text}`).join("\n").slice(-12000)
  const before = score ? `The score a few seconds ago was intent ${score.intent}, commitment ${score.commitment}, stage ${score.stage}. Move it only on new evidence.` : ""
  const raw = await haiku([SCORE_RULES, before, SCORE_SHAPE].filter(Boolean).join("\n"),
    `SALESPERSON: ${who.agent}. CUSTOMER: ${who.lead}${who.known ? "" : " (name not on file: use the name they give on the call, if any)"}. Use their names in why and next.\n\nOPEN QUESTIONS:\n${open.length ? open.map((x) => `${x.i + 1}. ${x.q}`).join("\n") : "(none left)"}\n\nTRANSCRIPT:\n${said}`, 600).catch(() => "")
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return
  let got: Record<string, unknown> = {}
  try { got = JSON.parse(m[0]) } catch { return }
  const answers = (got.answers && typeof got.answers === "object" ? got.answers : {}) as Record<string, unknown>
  for (const [n, a] of Object.entries(answers)) {
    const i = Number(n) - 1
    if (Number.isInteger(i) && i >= 0 && i < guide.length && covered[String(i)] === undefined && typeof a === "string" && a.trim() && !NOT_AN_ANSWER.test(a.trim())) covered[String(i)] = a.trim().slice(0, 160)
  }
  if (got.intent !== undefined) {
    score = {
      intent: clamp(got.intent), commitment: clamp(got.commitment),
      stage: got.stage === "pain" ? "pain" : got.stage === "problem" ? "problem" : "value",
      loss: String(got.loss || "").slice(0, 60), why: String(got.why || "").slice(0, 160), next: String(got.next || "").slice(0, 120),
    }
  }
  await save()
}

/** One piece of one voice. Returns what was heard ("" when it was silence). */
export async function takePiece(callId: string, track: string, seq: number, pcm: Buffer): Promise<string> {
  const { le, rms } = toLittleEndian(pcm)
  if (le.length < 8000 || rms < QUIET_RMS) return ""
  const h = await hear(le)
  const text = h.text
  // Line noise comes back as a stray word in a guessed language: drop short pieces it was unsure of.
  if (text && h.sure < 0.6 && text.split(/\s+/).length <= 3) return ""
  if (text) {
    // On the lead's leg, "inbound" is the lead speaking; "outbound" is what they hear: our caller.
    const line: LiveLine = { who: track === "inbound" ? "lead" : "caller", text, at: new Date().toISOString() }
    if (!isEnglish(h.lang)) {
      line.lang = h.lang
      const en = await toEnglish(text)
      if (en && en.toLowerCase() !== text.toLowerCase()) line.en = en.slice(0, 600)
    }
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
