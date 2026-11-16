// Vobiz REST + XML for the team dialer. SERVER ONLY.
// API shape follows the calls PROXe already makes (X-Auth-ID / X-Auth-Token,
// /Account/{id}/Call/) and docs.vobiz.ai (read 16 Nov 2026).

const API = "https://api.vobiz.ai/api/v1"

function auth() {
  return { "X-Auth-ID": process.env.VOBIZ_AUTH_ID || "", "X-Auth-Token": process.env.VOBIZ_AUTH_TOKEN || "" }
}

async function vobiz<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const id = process.env.VOBIZ_AUTH_ID
  if (!id || !process.env.VOBIZ_AUTH_TOKEN) throw new Error("Vobiz is not configured on ARC.")
  const r = await fetch(`${API}/Account/${id}/${path}`, {
    ...init,
    headers: { ...auth(), "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`Vobiz ${init.method || "GET"} ${path.split("?")[0]} ${r.status}: ${text.slice(0, 200)}`)
  return (text ? JSON.parse(text) : null) as T
}

/** Ring `to` from `from`; Vobiz fetches answer_url for the XML once they pick up. */
export async function makeCall(input: { from: string; to: string; answerUrl: string; hangupUrl: string; callerName?: string }) {
  return vobiz<{ request_uuid?: string; message?: string }>("Call/", {
    method: "POST",
    body: JSON.stringify({
      from: input.from, to: input.to,
      answer_url: input.answerUrl, answer_method: "POST",
      hangup_url: input.hangupUrl, hangup_method: "POST",
      time_limit: 7200,
      ...(input.callerName ? { caller_name: input.callerName } : {}),
    }),
  })
}

/** Hang up a live leg; before it is answered, cancel the queued request instead. */
export async function hangup(callUuid: string | null, requestUuid: string | null) {
  if (callUuid) {
    try { await vobiz(`Call/${encodeURIComponent(callUuid)}/`, { method: "DELETE" }); return true } catch { /* fall through */ }
  }
  if (requestUuid) {
    try { await vobiz(`Request/${encodeURIComponent(requestUuid)}/`, { method: "DELETE" }); return true } catch { /* not live */ }
  }
  return false
}

type RecordingRow = { recording_id?: string; recording_url?: string; call_uuid?: string; recording_duration_ms?: number | string; add_time?: string }

/** The backstop: find a call's recording through the Recording API when the callback never came. */
export async function findRecording(callUuid: string): Promise<{ id: string | null; url: string } | null> {
  const d = await vobiz<{ objects?: RecordingRow[] }>(`Recording/?call_uuid=${encodeURIComponent(callUuid)}&limit=5`)
  const hit = (d?.objects || []).find((o) => !o.call_uuid || o.call_uuid === callUuid)
  return hit?.recording_url ? { id: hit.recording_id || null, url: hit.recording_url } : null
}

/** Recording URLs need the account headers; they are not public links. */
export async function downloadRecording(url: string): Promise<{ bytes: Buffer; type: string }> {
  if (!/^https:\/\/[^/]*vobiz\.ai\//i.test(url)) throw new Error("Recording URL is not a Vobiz URL.")
  const r = await fetch(url, { headers: auth(), cache: "no-store", signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error(`Recording download ${r.status}`)
  const bytes = Buffer.from(await r.arrayBuffer())
  if (bytes.length < 1000) throw new Error("Recording file is empty.")
  // The docs warn the container may not match the extension: sniff it.
  const wav = bytes.subarray(0, 4).toString("ascii") === "RIFF"
  return { bytes, type: wav ? "audio/wav" : "audio/mpeg" }
}

// ── Provisioning: the team numbers' application ───────────────────────
// One Vobiz application ("ARC-team-dialer") holds the answer/hangup URLs with the
// webhook token, so nobody ever types the token into the console.
export const APP_NAME = "ARC-team-dialer"

type App = { app_id: string; app_name: string; answer_url?: string; hangup_url?: string }

export async function ensureApplication(answerUrl: string, hangupUrl: string): Promise<string> {
  let found: App | undefined
  for (let offset = 0; offset < 1000 && !found; offset += 100) {
    const page = await vobiz<{ objects?: App[]; meta?: { next?: string | null } }>(`Application/?limit=100&offset=${offset}`)
    found = (page?.objects || []).find((a) => a.app_name === APP_NAME)
    if (!page?.meta?.next) break
  }
  const urls = { answer_url: answerUrl, answer_method: "POST", hangup_url: hangupUrl, hangup_method: "POST" }
  if (found) {
    if (found.answer_url !== answerUrl || found.hangup_url !== hangupUrl) {
      await vobiz(`Application/${encodeURIComponent(found.app_id)}/`, { method: "POST", body: JSON.stringify(urls) })
    }
    return found.app_id
  }
  const made = await vobiz<{ app_id?: string }>("Application/", { method: "POST", body: JSON.stringify({ app_name: APP_NAME, ...urls }) })
  if (!made?.app_id) throw new Error("Vobiz did not return an application id.")
  return String(made.app_id)
}

/** Point an owned number at the application (re-attaching overwrites the old binding). */
export async function attachNumber(number: string, appId: string) {
  return vobiz(`numbers/${encodeURIComponent(number)}/application`, { method: "POST", body: JSON.stringify({ application_id: appId }) })
}

// ── XML ───────────────────────────────────────────────────────────────
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")

export function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  })
}
export const speak = (text: string) => `<Speak>${esc(text)}</Speak>`

/** Record the whole leg from now until hang-up; Vobiz posts RecordStop to callbackUrl. */
export const recordSession = (callbackUrl: string) =>
  `<Record recordSession="true" fileFormat="mp3" maxLength="7200" playBeep="false" redirect="false" callbackUrl="${esc(callbackUrl)}" callbackMethod="POST"/>`
