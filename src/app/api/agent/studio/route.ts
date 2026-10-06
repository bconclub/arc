// The editor's side of the Studio. Bearer ARC_INGEST_SECRET (lib/ingest-auth.ts);
// exempt from the cookie gate via api/agent in middleware.
//
// POST { action: "inbox" }                          open + doing requests across brands, oldest first
// POST { action: "brands" }                         every active brand: mood, palette, brief, links
// POST { action: "brand", slug }                    one brand with its board (signed image URLs)
// POST { action: "take", id }                       request -> doing, assigned to the caller
// POST { action: "update", id, status?, body?, title? }
// POST { action: "upload_url", slug, name }         -> { path, signedUrl }
// POST { action: "add", slug, kind, title?, body?, image_path?, prompt?, source?, parent_id?, tags? }
// POST { action: "upsert_brand", slug?, name, mood?, palette?, brief?, site_url?, instagram?, drive_url?, logo_path?, status? }
import { checkIngestAuth, authError } from "@/lib/ingest-auth"
import { supabaseAdmin } from "@/lib/supabase"
import { db, brandBySlug, brandPatch, itemPatch, withUrls, slugify, safeFile, STUDIO_BUCKET, ITEM_KINDS, type StudioItem } from "@/lib/studio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = checkIngestAuth(req)
  if (!auth.ok) return authError(auth)
  const body = await req.json().catch(() => ({}))
  const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status })

  switch (body.action) {
    case "inbox": {
      const { data, error } = await db
        .from("studio_items")
        .select("id, kind, title, body, status, assignee, created_at, studio_brands(slug, name)")
        .eq("kind", "request")
        .in("status", ["open", "doing"])
        .order("created_at", { ascending: true })
      if (error) return bad(error.message, 500)
      return Response.json({ requests: data || [] })
    }

    case "brands": {
      const { data } = await db.from("studio_brands").select("slug, name, status, mood, palette, brief, site_url, instagram, drive_url").neq("status", "archived").order("name")
      return Response.json({ brands: data || [] })
    }

    case "brand": {
      const brand = await brandBySlug(String(body.slug || ""))
      if (!brand) return bad("brand not found", 404)
      const [{ data }, { data: votes }] = await Promise.all([
        db.from("studio_items").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(300),
        db.from("studio_votes").select("item_id, voter, choice, comment").eq("brand_id", brand.id).not("sent_at", "is", null),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const picks = (votes || []) as any[]
      const items = (await withUrls((data || []) as StudioItem[])).map((i) => ({ ...i, votes: picks.filter((v) => v.item_id === i.id) }))
      // share_token is the client's credential: editors don't need it.
      const { share_token: _t, ...safe } = brand
      void _t
      return Response.json({ brand: safe, items })
    }

    case "take":
    case "update": {
      if (!body.id) return bad("id required")
      const patch = body.action === "take" ? { status: "doing", assignee: auth.agent } : itemPatch(body)
      if (!Object.keys(patch).length) return bad("nothing to change")
      const { error } = await db.from("studio_items").update(patch).eq("id", body.id)
      if (error) return bad(error.message, 500)
      return Response.json({ ok: true })
    }

    case "upload_url": {
      const brand = await brandBySlug(String(body.slug || ""))
      if (!brand) return bad("brand not found", 404)
      if (!body.name) return bad("name required")
      const path = `${brand.slug}/${Date.now().toString(36)}-${safeFile(String(body.name))}`
      const { data, error } = await supabaseAdmin.storage.from(STUDIO_BUCKET).createSignedUploadUrl(path)
      if (error) return bad(error.message, 500)
      return Response.json({ path, signedUrl: data.signedUrl })
    }

    case "add": {
      const brand = await brandBySlug(String(body.slug || ""))
      if (!brand) return bad("brand not found", 404)
      if (!(ITEM_KINDS as readonly string[]).includes(body.kind)) return bad("kind must be request, idea, note or image")
      const { data, error } = await db
        .from("studio_items")
        .insert({ ...itemPatch(body), brand_id: brand.id, kind: body.kind, created_by: auth.agent })
        .select("id")
        .single()
      if (error) return bad(error.message, 500)
      await db.from("studio_brands").update({ updated_at: new Date().toISOString() }).eq("id", brand.id)
      return Response.json({ id: data.id })
    }

    case "upsert_brand": {
      const name = String(body.name || "").trim()
      const slug = slugify(body.slug || name)
      if (!slug) return bad("name required")
      const existing = await brandBySlug(slug)
      const patch = brandPatch(body)
      const { error } = existing
        ? await db.from("studio_brands").update(patch).eq("id", existing.id)
        : await db.from("studio_brands").insert({ ...patch, name: name || slug, slug })
      if (error) return bad(error.message, 500)
      return Response.json({ slug, created: !existing })
    }

    default:
      return bad("unknown action")
  }
}
