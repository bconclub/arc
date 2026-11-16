// One product under review: its ads, each ad's cuts (with playable links),
// everyone's ratings and the comment thread.
//
// GET -> { brand, product, me, ads: [{ ..., files: [...], ratings: [...], comments: [...] }] }
import { db } from "@/lib/studio"
import { fileUrl, productBySlugs, reviewerName, type ReviewFile } from "@/lib/review"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Reads go through supabase-js fetch; without this Next serves a cached copy and a
// new score or comment does not show until the cache turns over.
export const fetchCache = "force-no-store"
export const revalidate = 0

export async function GET(_req: Request, { params }: { params: { brand: string; product: string } }) {
  const found = await productBySlugs(params.brand, params.product)
  if (!found) return Response.json({ error: "Not found." }, { status: 404 })
  const { brand, product } = found

  const { data: adsData, error } = await db.from("review_ads").select("*").eq("product_id", product.id)
    .order("position", { ascending: true, nullsFirst: false }).order("code")
  if (error) return Response.json({ error: error.message }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ads = (adsData || []) as any[]
  const ids = ads.map((a) => a.id)
  const [files, ratings, comments] = ids.length ? await Promise.all([
    db.from("review_files").select("id, ad_id, variant, fmt, kind, storage, path, bytes").in("ad_id", ids).order("created_at"),
    db.from("review_ratings").select("ad_id, reviewer, rating, updated_at").in("ad_id", ids),
    db.from("review_comments").select("id, ad_id, file_id, reviewer, body, at_seconds, created_at").in("ad_id", ids).order("created_at"),
  ]) : [{ data: [] }, { data: [] }, { data: [] }]

  const me = await reviewerName()
  const fileRows = (files.data || []) as ReviewFile[]
  return Response.json({
    brand: { slug: brand.slug, name: brand.name, palette: brand.palette || [] },
    product: { slug: product.slug, name: product.name, notes: product.notes, status: product.status },
    me: { name: me.name, owner: me.owner },
    ads: ads.map((a) => ({
      id: a.id, code: a.code, title: a.title, group: a.group_name, note: a.note, status: a.status,
      files: fileRows.filter((f) => f.ad_id === a.id).map((f) => ({ id: f.id, variant: f.variant, fmt: f.fmt, kind: f.kind, url: fileUrl(f) })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ratings: ((ratings.data || []) as any[]).filter((r) => r.ad_id === a.id).map((r) => ({ reviewer: r.reviewer, rating: r.rating })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comments: ((comments.data || []) as any[]).filter((c) => c.ad_id === a.id)
        .map((c) => ({ id: c.id, file_id: c.file_id, reviewer: c.reviewer, body: c.body, at: c.at_seconds, created_at: c.created_at })),
    })),
  })
}
