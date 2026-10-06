// Brand Reels list + queue a new link. Cookie-gated by middleware.
//
// GET  -> { reels, workers }   workers = heartbeats from brand-reel workers (the Mac)
// POST { urls: string | string[], brand?, note? } -> { created: [...], rejected: [...] }
import { db, normaliseIgUrl, queueJob, logEvent, BUCKET, type ReelOutput } from "@/lib/brand-reels"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const [reels, workers] = await Promise.all([
    db
      .from("brand_reels")
      .select("id, ig_url, brand, note, title, status, stage, progress, version, ref, outputs, drive_folder_url, worker, error, code, posted_url, posted_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("agent_heartbeats").select("agent, last_seen, version, note, healthy").like("version", "brand-reels/%"),
  ])
  if (reels.error) return Response.json({ error: reels.error.message }, { status: 500 })

  // One signed URL per reel for its newest final, so the library grid can show the video.
  const rows = (reels.data || []) as { version: number; outputs: ReelOutput[] }[]
  const finals = rows.map((r) => {
    const fs = (r.outputs || []).filter((o) => o.kind === "final")
    return fs.sort((a, b) => b.version - a.version)[0]?.path ?? null
  })
  const paths = finals.filter(Boolean) as string[]
  const signed = paths.length
    ? (await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 3600)).data || []
    : []
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]))
  const withMedia = rows.map((r, i) => ({ ...r, final_url: finals[i] ? urlFor.get(finals[i]!) ?? null : null }))

  return Response.json(
    { reels: withMedia, workers: workers.data || [] },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const raw: string[] = (Array.isArray(body.urls) ? body.urls : String(body.urls || "").split(/\s+/)).filter(Boolean)
  const brand = typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : "BCON"
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null

  const created: { id: string; ig_url: string }[] = []
  const rejected: { input: string; reason: string }[] = []
  const seen = new Set<string>()

  for (const input of raw) {
    const url = normaliseIgUrl(input)
    if (!url) {
      rejected.push({ input, reason: "not an Instagram reel or post link" })
      continue
    }
    if (seen.has(url)) continue
    seen.add(url)

    const { data: reel, error } = await db
      .from("brand_reels")
      .insert({ ig_url: url, brand, note })
      .select("id, ig_url")
      .single()
    if (error) {
      rejected.push({ input, reason: error.message })
      continue
    }
    try {
      await queueJob(reel.id, 1, null)
      await logEvent(reel.id, "created", note, "team")
      created.push(reel)
    } catch (e) {
      rejected.push({ input, reason: (e as Error).message })
    }
  }

  return Response.json({ created, rejected }, { status: created.length ? 201 : 400 })
}
