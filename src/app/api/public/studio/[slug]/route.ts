// A client's view of one brand board. No ARC login: the board's share key is the
// credential, and only boards the owner has shared answer at all.
//
// GET  ?k=<key>&voter=<name>  -> { brand, items, mine }   ideas + images only
// POST { k, item_id, voter, choice?: "like"|"pass"|null, comment? }   one pick per person per item
// POST { k, voter, submit: true }   "Send picks": posts a summary note to the admin board
import { db, signPaths, isClientVisible, sameKey, type StudioItem } from "@/lib/studio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NOPE = () => Response.json({ error: "This board is not available." }, { status: 404 })

async function sharedBrand(slug: string, key: string | null) {
  const { data } = await db
    .from("studio_brands")
    .select("id, slug, name, mood, palette, logo_path, share_token, share_enabled, share_intro")
    .eq("slug", slug)
    .maybeSingle()
  if (!data || !data.share_enabled || !sameKey(data.share_token, key)) return null
  return data
}

const cleanName = (s: unknown) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 60)

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url)
  const brand = await sharedBrand(params.slug, url.searchParams.get("k"))
  if (!brand) return NOPE()
  const voter = cleanName(url.searchParams.get("voter"))

  const [items, mine] = await Promise.all([
    db.from("studio_items").select("id, kind, title, body, status, image_path, hidden, pinned, parent_id, created_at").eq("brand_id", brand.id).order("created_at", { ascending: true }),
    voter ? db.from("studio_votes").select("item_id, choice, comment").eq("brand_id", brand.id).eq("voter", voter) : Promise.resolve({ data: [] }),
  ])
  const visible = ((items.data || []) as StudioItem[]).filter(isClientVisible)
  const urls = await signPaths([...visible.map((i) => i.image_path), brand.logo_path])

  return Response.json(
    {
      brand: { name: brand.name, mood: brand.mood, palette: brand.palette, intro: brand.share_intro, logo_url: brand.logo_path ? urls.get(brand.logo_path) ?? null : null },
      // Only what a client needs: no prompts, sources, authors or internal statuses.
      // An image whose parent is an idea is one of that idea's options; the rest is
      // reference material (what we were given), shown as context, not to pick from.
      items: visible.map((i) => ({ id: i.id, kind: i.kind, title: i.title, body: i.kind === "idea" ? i.body : null, url: i.image_path ? urls.get(i.image_path) ?? null : null, featured: i.pinned, parent_id: i.parent_id })),
      mine: mine.data || [],
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  )
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => ({}))
  const brand = await sharedBrand(params.slug, body.k)
  if (!brand) return NOPE()
  const voter = cleanName(body.voter)
  if (!voter) return Response.json({ error: "Add your name first." }, { status: 400 })

  if (body.submit === true) {
    const [{ data: votes }, { data: items }] = await Promise.all([
      db.from("studio_votes").select("item_id, choice, comment").eq("brand_id", brand.id).eq("voter", voter),
      db.from("studio_items").select("id, kind, title, parent_id").eq("brand_id", brand.id),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map(((items || []) as any[]).map((i) => [i.id, i]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines = ((votes || []) as any[]).map((v) => {
      const it = byId.get(v.item_id)
      const parent = it?.parent_id ? byId.get(it.parent_id) : null
      const what = parent ? `${parent.title}: option "${it?.title || "untitled"}"` : it?.title || "untitled"
      const verdict = v.choice === "like" ? "LOVE" : v.choice === "pass" ? "not for us" : "note"
      return `- ${verdict}: ${what}${v.comment ? ` (note: ${v.comment})` : ""}`
    })
    if (!lines.length) return Response.json({ error: "Pick at least one thing first." }, { status: 400 })
    await db.from("studio_items").insert({
      brand_id: brand.id, kind: "note", title: `${voter} sent their picks`, body: lines.join("\n"),
      created_by: `client: ${voter}`, tags: ["client-picks"],
    })
    await db.from("studio_brands").update({ updated_at: new Date().toISOString() }).eq("id", brand.id)
    return Response.json({ ok: true, sent: lines.length })
  }

  const { data: item } = await db.from("studio_items").select("id, brand_id, kind, hidden, status").eq("id", body.item_id).maybeSingle()
  if (!item || item.brand_id !== brand.id || !isClientVisible(item)) return NOPE()

  const choice = body.choice === "like" || body.choice === "pass" ? body.choice : null
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) || null : undefined
  const row: Record<string, unknown> = { brand_id: brand.id, item_id: item.id, voter, choice }
  if (comment !== undefined) row.comment = comment
  const { error } = await db.from("studio_votes").upsert(row, { onConflict: "item_id,voter" })
  if (error) return Response.json({ error: "Could not save that. Try again." }, { status: 500 })
  return Response.json({ ok: true })
}
