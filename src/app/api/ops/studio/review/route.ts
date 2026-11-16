// Studio Review home: every brand with something to review, and its products.
//
// GET  -> { brands: [{ slug, name, palette, products: [{ slug, name, notes, status, ads, waiting, approved, comments, avg }] }] }
// POST { brand, name, notes? } -> { slug }   (owner only: opens a new product for review)
import { db, slugify } from "@/lib/studio"
import { reviewerName } from "@/lib/review"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const [products, ads, ratings, comments] = await Promise.all([
    db.from("review_products").select("id, brand_id, slug, name, notes, status, position, updated_at").order("position", { ascending: true, nullsFirst: false }),
    db.from("review_ads").select("id, product_id, status"),
    db.from("review_ratings").select("ad_id, rating"),
    db.from("review_comments").select("ad_id"),
  ])
  if (products.error) return Response.json({ error: products.error.message }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prods = (products.data || []) as any[]
  const brandIds = Array.from(new Set(prods.map((p) => p.brand_id)))
  const { data: brands } = brandIds.length
    ? await db.from("studio_brands").select("id, slug, name, palette").in("id", brandIds)
    : { data: [] }

  const adRows = (ads.data || []) as { id: string; product_id: string; status: string }[]
  const adProduct = new Map(adRows.map((a) => [a.id, a.product_id]))
  const sum = new Map<string, { n: number; t: number }>()
  for (const r of (ratings.data || []) as { ad_id: string; rating: number }[]) {
    const p = adProduct.get(r.ad_id); if (!p) continue
    const s = sum.get(p) || { n: 0, t: 0 }; s.n++; s.t += r.rating; sum.set(p, s)
  }
  const talk = new Map<string, number>()
  for (const c of (comments.data || []) as { ad_id: string }[]) {
    const p = adProduct.get(c.ad_id); if (p) talk.set(p, (talk.get(p) || 0) + 1)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = ((brands || []) as any[]).map((b) => ({
    slug: b.slug, name: b.name, palette: b.palette || [],
    products: prods.filter((p) => p.brand_id === b.id).map((p) => {
      const mine = adRows.filter((a) => a.product_id === p.id)
      const s = sum.get(p.id)
      return {
        slug: p.slug, name: p.name, notes: p.notes, status: p.status, updated_at: p.updated_at,
        ads: mine.length,
        waiting: mine.filter((a) => a.status === "review").length,
        approved: mine.filter((a) => a.status === "approved" || a.status === "live").length,
        comments: talk.get(p.id) || 0,
        avg: s ? Math.round((s.t / s.n) * 10) / 10 : null,
      }
    }),
  })).sort((a, b) => a.name.localeCompare(b.name))
  return Response.json({ brands: out })
}

export async function POST(req: Request) {
  const who = await reviewerName()
  if (!who.owner) return Response.json({ error: "Only the owner can open a new product for review." }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim().slice(0, 80)
  if (!name) return Response.json({ error: "Give the product a name." }, { status: 400 })
  const { data: brand } = await db.from("studio_brands").select("id").eq("slug", String(body.brand || "")).maybeSingle()
  if (!brand) return Response.json({ error: "That brand is not in the Studio." }, { status: 404 })
  const slug = slugify(name) || "product"
  const { error } = await db.from("review_products").insert({ brand_id: brand.id, slug, name, notes: body.notes ? String(body.notes).slice(0, 600) : null })
  if (error) return Response.json({ error: error.code === "23505" ? "That product already exists." : error.message }, { status: 400 })
  return Response.json({ slug })
}
