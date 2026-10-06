// Studio: brands we create for, and everything on their boards. Shared by the
// dashboard routes (cookie) and the editor route (bearer).
import { supabaseAdmin } from "@/lib/supabase"

export const STUDIO_BUCKET = "studio"
export const ITEM_KINDS = ["request", "idea", "image", "note"] as const
export const ITEM_STATUSES = ["open", "doing", "done", "approved", "rejected", "parked"] as const
export const BRAND_FIELDS = ["name", "status", "mood", "palette", "brief", "site_url", "instagram", "drive_url", "logo_path"] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabaseAdmin as any

export type StudioItem = {
  id: string; brand_id: string; kind: string; title: string | null; body: string | null; status: string
  image_path: string | null; source: string | null; prompt: string | null; tags: string[]
  parent_id: string | null; created_by: string | null; assignee: string | null; pinned: boolean
  created_at: string; updated_at: string
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)
}

export const safeFile = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120)

/** Signed GET URLs for a batch of storage paths in one call. Missing paths map to nothing. */
export async function signPaths(paths: (string | null | undefined)[], bucket = STUDIO_BUCKET, ttl = 3600) {
  const unique = Array.from(new Set(paths.filter(Boolean) as string[]))
  if (!unique.length) return new Map<string, string>()
  const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrls(unique, ttl)
  return new Map((data || []).filter((d) => d.signedUrl).map((d) => [d.path as string, d.signedUrl]))
}

export async function brandBySlug(slug: string) {
  const { data } = await db.from("studio_brands").select("*").eq("slug", slug).maybeSingle()
  return data
}

/** Whitelists brand fields from a request body; palette must be hex colours. */
export function brandPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}
  for (const k of BRAND_FIELDS) {
    if (!(k in body)) continue
    const v = body[k]
    if (k === "palette") {
      patch.palette = (Array.isArray(v) ? v : String(v || "").split(/[\s,]+/))
        .map((c) => String(c).trim())
        .filter((c) => /^#?[0-9a-fA-F]{6}$/.test(c))
        .map((c) => (c.startsWith("#") ? c : `#${c}`).toUpperCase())
        .slice(0, 8)
    } else if (k === "status") {
      if (["intake", "active", "paused", "archived"].includes(String(v))) patch.status = v
    } else {
      patch[k] = typeof v === "string" ? v.trim() || null : v ?? null
    }
  }
  return patch
}

/** Whitelists item fields. */
export function itemPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 200) || null
  if (typeof body.body === "string") patch.body = body.body.trim().slice(0, 8000) || null
  if (typeof body.prompt === "string") patch.prompt = body.prompt.trim().slice(0, 8000) || null
  if (typeof body.source === "string") patch.source = body.source.slice(0, 20)
  if (typeof body.image_path === "string") patch.image_path = body.image_path
  if (typeof body.parent_id === "string") patch.parent_id = body.parent_id || null
  if (typeof body.assignee === "string") patch.assignee = body.assignee || null
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned
  if (Array.isArray(body.tags)) patch.tags = body.tags.map(String).slice(0, 12)
  if (typeof body.status === "string" && (ITEM_STATUSES as readonly string[]).includes(body.status)) patch.status = body.status
  return patch
}

/** Items with a signed `url` for any image. */
export async function withUrls(items: StudioItem[]) {
  const urls = await signPaths(items.map((i) => i.image_path))
  return items.map((i) => ({ ...i, url: i.image_path ? urls.get(i.image_path) ?? null : null }))
}
