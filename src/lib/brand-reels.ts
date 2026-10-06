// Shared bits for Brand Reels: the dashboard routes (cookie) and the worker
// route (bearer) both queue jobs and sign Storage URLs the same way.
import { supabaseAdmin } from "@/lib/supabase"

export const BUCKET = "brand-reels"
export const JOB_KIND = "brand_reel"

export type ReelOutput = {
  version: number
  kind: "final" | "variant" | "still" | "sheet" | "audio" | "source" | "doc"
  name: string
  path: string
  size?: number
  duration?: number
  drive_url?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabaseAdmin as any

/** instagram.com/reel|p|tv/<code>, query and tracking stripped. Null when it isn't one. */
export function normaliseIgUrl(raw: string): string | null {
  const m = raw.trim().match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]+)/i)
  if (!m) return null
  const kind = m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase()
  return `https://www.instagram.com/${kind}/${m[2]}/`
}

export async function logEvent(reelId: string, kind: string, note: string | null, actor: string) {
  await db.from("brand_reel_events").insert({ reel_id: reelId, kind, note, actor })
}

/** Puts one version of a reel on the queue and points the reel at that job. */
export async function queueJob(reelId: string, version: number, feedback: string | null) {
  const { data: job, error } = await db
    .from("agent_jobs")
    .insert({
      kind: JOB_KIND,
      payload: { reel_id: reelId, version, feedback },
      priority: 50,
      max_attempts: 2,
      idempotency_key: `${JOB_KIND}:${reelId}:v${version}`,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await db.from("brand_reels").update({ job_id: job.id }).eq("id", reelId)
  return job.id as string
}

/** Signed GET URLs for every output; `download` forces a save-as with the file name. */
export async function signOutputs(outputs: ReelOutput[], ttl = 3600) {
  if (!outputs.length) return []
  const storage = supabaseAdmin.storage.from(BUCKET)
  return Promise.all(
    outputs.map(async (o) => {
      const [view, dl] = await Promise.all([
        storage.createSignedUrl(o.path, ttl),
        storage.createSignedUrl(o.path, ttl, { download: o.name }),
      ])
      return { ...o, url: view.data?.signedUrl ?? null, download_url: dl.data?.signedUrl ?? null }
    })
  )
}
