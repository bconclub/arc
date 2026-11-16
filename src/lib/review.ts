// Studio Review: shared helpers for the review routes.
import { db } from "@/lib/studio"
import { getViewer } from "@/lib/team"
import { r2Configured, r2Presign } from "@/lib/r2"

export const AD_STATUSES = ["review", "waiting", "blocked", "approved", "changes", "live"] as const

export type ReviewFile = { id: string; ad_id: string; variant: string | null; fmt: string; kind: string; storage: string; path: string; bytes: number | null }

/**
 * Who is speaking. The owner and named team logins are known from their cookie;
 * the shared studio login has no name, so the page sends the one the person typed.
 */
export async function reviewerName(typed?: unknown): Promise<{ name: string | null; owner: boolean }> {
  const v = await getViewer().catch(() => null)
  if (v?.kind === "owner") return { name: "Z", owner: true }
  if (v?.kind === "team") return { name: v.member.name, owner: false }
  const n = typeof typed === "string" ? typed.trim().replace(/\s+/g, " ").slice(0, 40) : ""
  return { name: n || null, owner: false }
}

/** Playable link for a file: a signed R2 link, a Drive preview, or the URL itself. */
export function fileUrl(f: ReviewFile): string | null {
  if (f.storage === "url") return /^https:\/\//i.test(f.path) ? f.path : null
  if (f.storage === "drive") return `https://drive.google.com/file/d/${encodeURIComponent(f.path)}/preview`
  if (!r2Configured()) return null
  return r2Presign(f.path, { expires: 6 * 3600 })
}

export async function productBySlugs(brandSlug: string, productSlug: string) {
  const { data: brand } = await db.from("studio_brands").select("id, slug, name, palette, logo_path").eq("slug", brandSlug).maybeSingle()
  if (!brand) return null
  const { data: product } = await db.from("review_products").select("*").eq("brand_id", brand.id).eq("slug", productSlug).maybeSingle()
  return product ? { brand, product } : null
}
