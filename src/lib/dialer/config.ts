// Team dialer: settings, the webhook token and phone helpers. SERVER ONLY.
//
// Env (ARC's Vercel project):
//   VOBIZ_AUTH_ID, VOBIZ_AUTH_TOKEN  the Vobiz account the numbers live on
//   DIALER_BASE_URL                  optional; where Vobiz posts back (default https://arc.bconclub.com)
//   SESSION_SECRET                   already set; the webhook token is derived from it, so no new secret
// Recordings use the existing R2_* env, transcripts ELEVENLABS_API_KEY, notes ANTHROPIC_API_KEY,
// PROXe writes PROXE_DB_URL + PROXE_DB_SERVICE_KEY.
import { createHmac, timingSafeEqual } from "crypto"

export function vobizConfigured() {
  return Boolean(process.env.VOBIZ_AUTH_ID && process.env.VOBIZ_AUTH_TOKEN)
}

export function baseUrl() {
  return (process.env.DIALER_BASE_URL || "https://arc.bconclub.com").replace(/\/$/, "")
}

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error("SESSION_SECRET is not set.")
  return s
}

const sign = (purpose: string) => createHmac("sha256", secret()).update("dialer:" + purpose).digest("base64url")

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Vobiz webhooks carry this token in the URL. It never leaves the server except inside the URLs we give Vobiz. */
export const hookToken = () => sign("hook")
export const hookOk = (req: Request) => {
  try {
    return same(new URL(req.url).searchParams.get("s") || "", hookToken())
  } catch {
    return false
  }
}

/** A recording link that works without a login (PROXe's player follows it): one key per call. */
export const recordingKey = (callId: string) => sign("rec:" + callId).slice(0, 32)
export const recordingKeyOk = (callId: string, k: string | null) => {
  try {
    return Boolean(k) && same(k!, recordingKey(callId))
  } catch {
    return false
  }
}
export const recordingLink = (callId: string) =>
  `${baseUrl()}/api/agent/dialer/recording/${callId}?k=${recordingKey(callId)}`

/** A webhook URL with the token and any extra query values. */
export function hookUrl(path: string, q: Record<string, string> = {}) {
  const u = new URL(`${baseUrl()}/api/agent/dialer/${path}`)
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v)
  u.searchParams.set("s", hookToken())
  return u.toString()
}

/** Free-form Indian phone -> +91XXXXXXXXXX. Other countries pass through when they already carry a +. */
export function e164(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim()
  const d = s.replace(/\D/g, "")
  if (s.startsWith("+") && d.length >= 10 && d.length <= 15) return "+" + d
  if (d.length === 10) return "+91" + d
  if (d.length === 12 && d.startsWith("91")) return "+" + d
  if (d.length === 11 && d.startsWith("0")) return "+91" + d.slice(1)
  return null
}
export const tail10 = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-10)

/** Vobiz posts form data; field names vary in case between events. */
export async function vobizParams(req: Request): Promise<(name: string) => string> {
  const text = await req.text().catch(() => "")
  let obj: Record<string, string> = {}
  try {
    obj = text.trim().startsWith("{") ? JSON.parse(text) : Object.fromEntries(new URLSearchParams(text))
  } catch { /* empty */ }
  const lower = new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), String(v ?? "")]))
  return (name: string) => lower.get(name.toLowerCase()) || ""
}
