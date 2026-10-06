// Studio home: every brand with its board counts and a cover image.
//
// GET  -> { brands: [...] }
// POST { name, mood?, palette?, site_url?, instagram?, brief? } -> { slug }
import { db, slugify, brandPatch, signPaths } from "@/lib/studio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const [brands, items, reels] = await Promise.all([
    db.from("studio_brands").select("*").neq("status", "archived").order("updated_at", { ascending: false }),
    db.from("studio_items").select("brand_id, kind, status, image_path, pinned, created_at").order("created_at", { ascending: false }),
    db.from("brand_reels").select("brand, status"),
  ])
  if (brands.error) return Response.json({ error: brands.error.message }, { status: 500 })

  type Row = { brand_id: string; kind: string; status: string; image_path: string | null; pinned: boolean }
  const rows = (items.data || []) as Row[]
  const reelRows = (reels.data || []) as { brand: string; status: string }[]

  const cover = new Map<string, string>()
  for (const r of rows) {
    if (r.kind !== "image" || !r.image_path) continue
    // Pinned image wins; otherwise the newest image (rows arrive newest first).
    if (r.pinned || !cover.has(r.brand_id)) cover.set(r.brand_id, r.image_path)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (brands.data || []) as any[]
  const urls = await signPaths([...Array.from(cover.values()), ...list.map((b) => b.logo_path)])

  const out = list.map((b) => {
    const mine = rows.filter((r) => r.brand_id === b.id)
    const myReels = reelRows.filter((r) => r.brand.toLowerCase() === b.name.toLowerCase())
    return {
      ...b,
      cover_url: cover.has(b.id) ? urls.get(cover.get(b.id)!) ?? null : null,
      logo_url: b.logo_path ? urls.get(b.logo_path) ?? null : null,
      counts: {
        requests_open: mine.filter((r) => r.kind === "request" && (r.status === "open" || r.status === "doing")).length,
        ideas: mine.filter((r) => r.kind === "idea").length,
        images: mine.filter((r) => r.kind === "image").length,
        reels: myReels.length,
        live: myReels.filter((r) => r.status === "live").length,
      },
    }
  })
  return Response.json({ brands: out }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return Response.json({ error: "give the brand a name" }, { status: 400 })
  const slug = slugify(body.slug || name)
  const { error } = await db.from("studio_brands").insert({ ...brandPatch(body), name, slug, status: body.status || "intake" })
  if (error) {
    const dup = /duplicate/.test(error.message)
    return Response.json({ error: dup ? `${name} is already in the studio` : error.message }, { status: dup ? 409 : 500 })
  }
  return Response.json({ slug }, { status: 201 })
}
