// Add to a brand's board, or get a signed upload URL for an image first.
//
// POST { kind: "request"|"idea"|"note"|"image", title?, body?, image_path?, prompt?, source?, parent_id? }
// POST { upload: "<file name>" } -> { path, signedUrl }   (browser PUTs the file, then posts the item)
import { db, brandBySlug, itemPatch, safeFile, STUDIO_BUCKET, ITEM_KINDS } from "@/lib/studio"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const brand = await brandBySlug(params.slug)
  if (!brand) return Response.json({ error: "brand not found" }, { status: 404 })
  const body = await req.json().catch(() => ({}))

  if (typeof body.upload === "string" && body.upload) {
    const path = `${brand.slug}/${Date.now().toString(36)}-${safeFile(body.upload)}`
    const { data, error } = await supabaseAdmin.storage.from(STUDIO_BUCKET).createSignedUploadUrl(path)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ path, signedUrl: data.signedUrl })
  }

  if (!(ITEM_KINDS as readonly string[]).includes(body.kind)) return Response.json({ error: "kind must be request, idea, note or image" }, { status: 400 })
  const patch = itemPatch(body)
  if (body.kind === "image" && !patch.image_path) return Response.json({ error: "upload the image first" }, { status: 400 })
  if (body.kind !== "image" && !patch.title && !patch.body) return Response.json({ error: "write something first" }, { status: 400 })

  const { data, error } = await db
    .from("studio_items")
    .insert({ ...patch, brand_id: brand.id, kind: body.kind, source: patch.source || (body.kind === "image" ? "upload" : null), created_by: "team" })
    .select("id")
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await db.from("studio_brands").update({ updated_at: new Date().toISOString() }).eq("id", brand.id)
  return Response.json({ id: data.id }, { status: 201 })
}
