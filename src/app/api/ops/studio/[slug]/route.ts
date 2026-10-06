// One brand's studio: brand, board items (signed), and its reels.
//
// GET   -> { brand, items, reels }
// PATCH { mood?, palette?, brief?, status?, site_url?, instagram?, drive_url?, name?, logo_path? }
import { db, brandBySlug, brandPatch, withUrls, signPaths, type StudioItem } from "@/lib/studio"
import { BUCKET as REELS_BUCKET, type ReelOutput } from "@/lib/brand-reels"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const brand = await brandBySlug(params.slug)
  if (!brand) return Response.json({ error: "brand not found" }, { status: 404 })

  const [items, reels, votes, events] = await Promise.all([
    db.from("studio_items").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(500),
    db.from("brand_reels").select("id, title, code, status, version, outputs, posted_url, updated_at").ilike("brand", brand.name).order("updated_at", { ascending: false }),
    db.from("studio_votes").select("item_id, voter, choice, comment, updated_at, sent_at").eq("brand_id", brand.id).order("updated_at", { ascending: false }),
    db.from("studio_events").select("id, at, kind, voter, item_id, session, meta").eq("brand_id", brand.id).order("at", { ascending: false }).limit(80),
  ])
  // Client picks from the shared board, grouped per item.
  // Only picks the client has sent count. Drafts are summarised, never acted on.
  type Vote = { item_id: string; voter: string; choice: string | null; comment: string | null; updated_at: string; sent_at: string | null }
  const all = (votes.data || []) as Vote[]
  const byItem = new Map<string, Vote[]>()
  for (const v of all.filter((x) => x.sent_at)) byItem.set(v.item_id, [...(byItem.get(v.item_id) || []), v])
  const drafting = Array.from(new Set(all.filter((x) => !x.sent_at && (x.choice || x.comment)).map((x) => x.voter)))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reelRows = (reels.data || []) as any[]
  const finals = reelRows.map((r) => ((r.outputs || []) as ReelOutput[]).filter((o) => o.kind === "final").sort((a, b) => b.version - a.version)[0]?.path)
  const reelUrls = await signPaths(finals, REELS_BUCKET)
  const logo = brand.logo_path ? (await signPaths([brand.logo_path])).get(brand.logo_path) ?? null : null

  return Response.json(
    {
      brand: { ...brand, logo_url: logo, drafting },
      // What the client did on their link, newest first (open, view, choose, note, send...).
      activity: events.data || [],
      items: (await withUrls((items.data || []) as StudioItem[])).map((i) => ({ ...i, votes: byItem.get(i.id) || [] })),
      reels: reelRows.map((r, i) => ({ id: r.id, title: r.title, code: r.code, status: r.status, version: r.version, posted_url: r.posted_url, updated_at: r.updated_at, final_url: finals[i] ? reelUrls.get(finals[i]!) ?? null : null })),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const brand = await brandBySlug(params.slug)
  if (!brand) return Response.json({ error: "brand not found" }, { status: 404 })
  const patch = brandPatch(await req.json().catch(() => ({})))
  if (!Object.keys(patch).length) return Response.json({ error: "nothing to change" }, { status: 400 })
  const { error } = await db.from("studio_brands").update(patch).eq("id", brand.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
