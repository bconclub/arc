// Change or remove one board item.
//
// PATCH  { status?, title?, body?, pinned?, tags? }
// DELETE              removes the item and its image file
import { db, itemPatch, STUDIO_BUCKET } from "@/lib/studio"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const patch = itemPatch(await req.json().catch(() => ({})))
  if (!Object.keys(patch).length) return Response.json({ error: "nothing to change" }, { status: 400 })
  const { error } = await db.from("studio_items").update(patch).eq("id", params.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { data: item } = await db.from("studio_items").select("image_path").eq("id", params.id).maybeSingle()
  if (!item) return Response.json({ error: "not found" }, { status: 404 })
  if (item.image_path) await supabaseAdmin.storage.from(STUDIO_BUCKET).remove([item.image_path])
  await db.from("studio_items").delete().eq("id", params.id)
  return Response.json({ ok: true })
}
