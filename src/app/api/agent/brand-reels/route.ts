// The Brand Reels worker's side channel. Bearer ARC_INGEST_SECRET (see
// lib/ingest-auth.ts); exempt from the cookie gate via api/agent in middleware.
//
// POST { action: "list" }                                       -> what is waiting (for "pull")
// POST { action: "create",     ig_url, brand?, title?, code?, note? }  -> { id }  (imports, no job)
// POST { action: "get",        reel_id }                         -> reel + signed previous outputs
// POST { action: "progress",   reel_id, stage, progress, note?, title?, ref? }
// POST { action: "upload_url", reel_id, name }                   -> { path, signedUrl, token }
// POST { action: "complete",   reel_id, version, outputs, ref?, title?, drive_folder_url? }
// POST { action: "fail",       reel_id, error, requeued }
//
// The job row itself is still closed through /api/agent/result; this route only
// moves the reel the team is looking at.
import { checkIngestAuth, authError } from "@/lib/ingest-auth"
import { supabaseAdmin } from "@/lib/supabase"
import { db, logEvent, signOutputs, normaliseIgUrl, BUCKET, type ReelOutput } from "@/lib/brand-reels"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const safeName = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 160)

export async function POST(req: Request) {
  const auth = checkIngestAuth(req)
  if (!auth.ok) return authError(auth)

  const body = await req.json().catch(() => ({}))

  if (body.action === "list") {
    const { data } = await db
      .from("brand_reels")
      .select("id, code, title, ig_url, brand, note, status, version, feedback, created_at")
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: true })
    return Response.json({ reels: data || [] })
  }
  if (body.action === "create") {
    const ig = normaliseIgUrl(String(body.ig_url || ""))
    if (!ig) return Response.json({ error: "ig_url must be an Instagram reel or post link" }, { status: 400 })
    const { data, error } = await db
      .from("brand_reels")
      .insert({ ig_url: ig, brand: body.brand || "BCON", title: body.title || null, code: body.code || null, note: body.note || null, version: Number(body.version) || 1, status: "processing", worker: auth.agent })
      .select("id")
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await logEvent(data.id, "created", body.note || "pushed from an editor session", auth.agent)
    return Response.json({ id: data.id })
  }

  const reelId = typeof body.reel_id === "string" ? body.reel_id : ""
  if (!reelId) return Response.json({ error: "reel_id required" }, { status: 400 })

  const { data: reel, error } = await db.from("brand_reels").select("*").eq("id", reelId).single()
  if (error) return Response.json({ error: "reel not found" }, { status: 404 })

  switch (body.action) {
    case "get": {
      const outputs = await signOutputs((reel.outputs || []) as ReelOutput[], 6 * 3600)
      return Response.json({ reel: { ...reel, outputs } })
    }

    case "progress": {
      // The team cancelled it mid-run: tell the worker to stop instead of reviving it.
      if (reel.status === "cancelled") return Response.json({ ok: false, status: "cancelled" })
      const patch: Record<string, unknown> = { status: "processing", worker: auth.agent }
      if (typeof body.stage === "string") patch.stage = body.stage
      if (Number.isFinite(body.progress)) patch.progress = Math.max(0, Math.min(99, Math.round(body.progress)))
      if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 140)
      if (body.ref && typeof body.ref === "object") patch.ref = { ...(reel.ref || {}), ...body.ref }
      await db.from("brand_reels").update(patch).eq("id", reelId)
      if (body.note) await logEvent(reelId, "stage", `${body.stage ?? ""}: ${String(body.note).slice(0, 500)}`, auth.agent)
      return Response.json({ ok: true, status: reel.status })
    }

    case "upload_url": {
      if (typeof body.name !== "string" || !body.name) return Response.json({ error: "name required" }, { status: 400 })
      const path = `${reelId}/v${reel.version}/${safeName(body.name)}`
      const { data, error: upErr } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true })
      if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
      return Response.json({ path, signedUrl: data.signedUrl, token: data.token })
    }

    case "complete": {
      const version = Number(body.version) || reel.version
      const fresh: ReelOutput[] = (Array.isArray(body.outputs) ? body.outputs : []).map((o: ReelOutput) => ({ ...o, version }))
      if (!fresh.some((o) => o.kind === "final")) return Response.json({ error: "no final in outputs" }, { status: 400 })
      // Earlier versions stay, so the review screen can compare v1 with v2.
      const outputs = [...((reel.outputs || []) as ReelOutput[]).filter((o) => o.version !== version), ...fresh]
      await db
        .from("brand_reels")
        .update({
          status: "review",
          stage: "review",
          progress: 100,
          outputs,
          error: null,
          worker: auth.agent,
          ...(body.title && !reel.title ? { title: String(body.title).slice(0, 140) } : {}),
          ...(body.code ? { code: String(body.code).slice(0, 20) } : {}),
          ...(body.ref ? { ref: { ...(reel.ref || {}), ...body.ref } } : {}),
          ...(body.drive_folder_url ? { drive_folder_url: body.drive_folder_url } : {}),
        })
        .eq("id", reelId)
      await logEvent(reelId, "review", `v${version} ready for review (${fresh.length} files)`, auth.agent)
      return Response.json({ ok: true })
    }

    case "fail": {
      const msg = String(body.error || "failed").slice(0, 2000)
      await db
        .from("brand_reels")
        .update({ status: body.requeued ? "queued" : "failed", error: msg, worker: auth.agent })
        .eq("id", reelId)
      await logEvent(reelId, body.requeued ? "retry" : "failed", msg, auth.agent)
      return Response.json({ ok: true })
    }

    default:
      return Response.json({ error: "unknown action" }, { status: 400 })
  }
}
