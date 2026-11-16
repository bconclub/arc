// Feedback on one ad.
//
// POST  { name?, rating?: 1-5 | null, comment?, file_id?, at? } -> { ok }
//   rating sets (or with null clears) this person's score; comment adds to the thread.
//   name is only read for the shared studio login, which has no name of its own.
// PATCH { status } -> { ok }   owner only: review | waiting | blocked | approved | changes | live
// DELETE ?comment=<id> -> { ok }   the comment's author, or the owner
import { db } from "@/lib/studio"
import { AD_STATUSES, reviewerName } from "@/lib/review"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const isId = (s: unknown) => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s)

async function adExists(id: string) {
  const { data } = await db.from("review_ads").select("id").eq("id", id).maybeSingle()
  return !!data
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isId(params.id) || !(await adExists(params.id))) return Response.json({ error: "Not found." }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const who = await reviewerName(body.name)
  if (!who.name) return Response.json({ error: "Type your name first, so the team knows who said it." }, { status: 400 })

  if ("rating" in body) {
    if (body.rating === null) {
      await db.from("review_ratings").delete().eq("ad_id", params.id).eq("reviewer", who.name)
    } else {
      const n = Math.round(Number(body.rating))
      if (!(n >= 1 && n <= 5)) return Response.json({ error: "Rating is 1 to 5." }, { status: 400 })
      const { error } = await db.from("review_ratings").upsert({ ad_id: params.id, reviewer: who.name, rating: n }, { onConflict: "ad_id,reviewer" })
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }
  }
  if (typeof body.comment === "string" && body.comment.trim()) {
    const at = Number(body.at)
    const { error } = await db.from("review_comments").insert({
      ad_id: params.id, reviewer: who.name, body: body.comment.trim().slice(0, 2000),
      file_id: isId(body.file_id) ? body.file_id : null,
      at_seconds: Number.isFinite(at) && at >= 0 ? Math.round(at * 10) / 10 : null,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const who = await reviewerName()
  if (!who.owner) return Response.json({ error: "Only the owner sets an ad's status." }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (!isId(params.id) || !(AD_STATUSES as readonly string[]).includes(body.status)) return Response.json({ error: "Bad status." }, { status: 400 })
  const { error } = await db.from("review_ads").update({ status: body.status }).eq("id", params.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const cid = new URL(req.url).searchParams.get("comment")
  if (!isId(params.id) || !isId(cid)) return Response.json({ error: "Not found." }, { status: 404 })
  const { data: c } = await db.from("review_comments").select("reviewer").eq("id", cid).eq("ad_id", params.id).maybeSingle()
  if (!c) return Response.json({ error: "Not found." }, { status: 404 })
  const who = await reviewerName(new URL(req.url).searchParams.get("name"))
  if (!who.owner && who.name !== c.reviewer) return Response.json({ error: "Only the person who wrote it can remove it." }, { status: 403 })
  await db.from("review_comments").delete().eq("id", cid)
  return Response.json({ ok: true })
}
