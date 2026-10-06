// One reel: detail with signed media URLs, and the review actions.
//
// GET   -> { reel, events, outputs (signed) }
// PATCH { action: "approve" }
//       { action: "changes", feedback }   queues version + 1 with the notes
//       { action: "retry" }               re-runs the current version
//       { action: "cancel" }
//       { action: "live", posted_url }      posted on Instagram
//       { action: "rename", title }
import { db, queueJob, logEvent, signOutputs, type ReelOutput } from "@/lib/brand-reels"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const [reel, events] = await Promise.all([
    db.from("brand_reels").select("*").eq("id", params.id).single(),
    db.from("brand_reel_events").select("*").eq("reel_id", params.id).order("at", { ascending: false }).limit(100),
  ])
  if (reel.error) return Response.json({ error: reel.error.message }, { status: 404 })
  const outputs = await signOutputs((reel.data.outputs || []) as ReelOutput[])
  let sheet: string | null = null
  if (reel.data.ref?.sheet) {
    const s = await signOutputs([{ version: 0, kind: "sheet", name: "sheet.jpg", path: reel.data.ref.sheet }])
    sheet = s[0]?.url ?? null
  }
  return Response.json(
    { reel: reel.data, events: events.data || [], outputs, sheet },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const { data: reel, error } = await db.from("brand_reels").select("*").eq("id", params.id).single()
  if (error) return Response.json({ error: "reel not found" }, { status: 404 })

  const busy = reel.status === "queued" || reel.status === "processing"

  switch (body.action) {
    case "approve": {
      if (reel.status !== "review") return Response.json({ error: "only a reel in review can be approved" }, { status: 409 })
      await db.from("brand_reels").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", reel.id)
      await logEvent(reel.id, "approved", `v${reel.version} approved`, "team")
      break
    }
    case "changes": {
      const feedback = typeof body.feedback === "string" ? body.feedback.trim() : ""
      if (!feedback) return Response.json({ error: "say what should change" }, { status: 400 })
      if (busy) return Response.json({ error: "this reel is still being made, wait for review" }, { status: 409 })
      const version = reel.version + 1
      await db
        .from("brand_reels")
        .update({ status: "queued", stage: null, progress: 0, version, feedback: feedback.slice(0, 4000), error: null, approved_at: null })
        .eq("id", reel.id)
      await queueJob(reel.id, version, feedback)
      await logEvent(reel.id, "changes", `v${version} requested: ${feedback}`, "team")
      break
    }
    case "retry": {
      if (busy) return Response.json({ error: "already on the queue" }, { status: 409 })
      await db.from("agent_jobs").update({ status: "cancelled" }).eq("id", reel.job_id).in("status", ["queued", "failed"])
      await db.from("brand_reels").update({ status: "queued", stage: null, progress: 0, error: null }).eq("id", reel.id)
      // A retry reuses the version number, so the idempotency key would collide with
      // the old job only while that job is still queued or running, which busy rules out.
      await queueJob(reel.id, reel.version, reel.feedback)
      await logEvent(reel.id, "retry", `v${reel.version} re-queued`, "team")
      break
    }
    case "cancel": {
      await db.from("agent_jobs").update({ status: "cancelled" }).eq("id", reel.job_id).eq("status", "queued")
      await db.from("brand_reels").update({ status: "cancelled" }).eq("id", reel.id)
      await logEvent(reel.id, "cancelled", null, "team")
      break
    }
    case "live": {
      if (!["review", "approved", "live"].includes(reel.status)) return Response.json({ error: "only a finished reel can go live" }, { status: 409 })
      const url = typeof body.posted_url === "string" ? body.posted_url.trim() : ""
      if (url && !/^https?:\/\//.test(url)) return Response.json({ error: "paste the full post link, starting with https://" }, { status: 400 })
      await db.from("brand_reels").update({ status: "live", posted_url: url || null, posted_at: new Date().toISOString(), approved_at: reel.approved_at || new Date().toISOString() }).eq("id", reel.id)
      await logEvent(reel.id, "live", url ? `live: ${url}` : "marked live", "team")
      break
    }
    case "rename": {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : ""
      if (!title) return Response.json({ error: "title can't be empty" }, { status: 400 })
      await db.from("brand_reels").update({ title }).eq("id", reel.id)
      break
    }
    default:
      return Response.json({ error: "unknown action" }, { status: 400 })
  }
  return Response.json({ ok: true })
}
