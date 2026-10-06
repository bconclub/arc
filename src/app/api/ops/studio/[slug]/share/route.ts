// Turn a brand's client link on or off, or issue a new key (which kills the old link).
//
// POST { enabled: boolean, rotate?: boolean, intro?: string } -> { enabled, path }
import { randomBytes } from "node:crypto"
import { db, brandBySlug } from "@/lib/studio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const brand = await brandBySlug(params.slug)
  if (!brand) return Response.json({ error: "brand not found" }, { status: 404 })
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (typeof body.enabled === "boolean") patch.share_enabled = body.enabled
  if (typeof body.intro === "string") patch.share_intro = body.intro.trim().slice(0, 600) || null
  const token = !brand.share_token || body.rotate ? randomBytes(12).toString("base64url") : brand.share_token
  if (token !== brand.share_token) patch.share_token = token

  const { error } = await db.from("studio_brands").update(patch).eq("id", brand.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const enabled = typeof body.enabled === "boolean" ? body.enabled : brand.share_enabled
  return Response.json({ enabled, path: `/studio/${brand.slug}?k=${token}` })
}
