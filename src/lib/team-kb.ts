// The sales team's knowledge base (team_kb): sections, reads, and the text the
// Ask assistant answers from. Shared by /team/playbook, the owner's editor on
// /dashboard/team, and the PROXe push endpoint.
import { tdb } from "@/lib/team"

export const KB_SECTIONS = [
  { key: "pipeline", label: "Pipeline", blurb: "Every stage a lead goes through, what you do at each one, and when it moves on." },
  { key: "product", label: "What PROXe is", blurb: "What it does, who buys it, and what not to promise." },
  { key: "bcon", label: "BCON Club", blurb: "Who we are and what else BCON builds, from PROXe's knowledge base." },
  { key: "links", label: "Links to share", blurb: "What to send, and the moment to send it." },
  { key: "rebuttals", label: "Rebuttals", blurb: "What they say, and what you say back." },
  { key: "pricing", label: "Pricing", blurb: "Plans, top-ups and billing. Never quote anything else." },
  { key: "process", label: "How we work", blurb: "Calls, your day, logging, and when to bring in Z." },
  { key: "faq", label: "FAQ", blurb: "Quick answers to common questions." },
] as const
export type KbSection = (typeof KB_SECTIONS)[number]["key"]
export const isSection = (s: unknown): s is KbSection => KB_SECTIONS.some((x) => x.key === s)

export type KbEntry = {
  id: string; section: KbSection; title: string; body: string; url: string | null; when_to_share: string | null
  tags: string[]; position: number; source: "arc" | "proxe"; external_id: string | null; updated_at: string
}

export async function listKb(): Promise<KbEntry[]> {
  const { data, error } = await tdb.from("team_kb").select("*").order("section").order("position").order("title")
  if (error) throw new Error(error.message)
  return (data || []) as KbEntry[]
}

/** The whole knowledge base as plain text, section by section, for the assistant's prompt. */
export function kbAsText(entries: KbEntry[]): string {
  return KB_SECTIONS.map((s) => {
    const rows = entries.filter((e) => e.section === s.key)
    if (!rows.length) return ""
    return `## ${s.label}\n` + rows.map((e) => [
      `### ${e.title}`,
      e.body,
      e.url ? `Link: ${e.url}` : "",
      e.when_to_share ? `When to share: ${e.when_to_share}` : "",
    ].filter(Boolean).join("\n")).join("\n\n")
  }).filter(Boolean).join("\n\n")
}

/** Whitelist an entry from a request body (owner editor or PROXe push). */
export function kbPatch(b: Record<string, unknown>, partial: boolean): Record<string, unknown> | string {
  const p: Record<string, unknown> = {}
  if ("section" in b || !partial) {
    if (!isSection(b.section)) return "Pick a section."
    p.section = b.section
  }
  if ("title" in b || !partial) {
    const t = String(b.title || "").trim().slice(0, 200)
    if (!t) return "Add a title."
    p.title = t
  }
  if ("body" in b) p.body = String(b.body || "").slice(0, 20000)
  if ("url" in b) {
    const u = String(b.url || "").trim()
    if (u && !/^https?:\/\//i.test(u)) return "Links must start with http:// or https://"
    p.url = u || null
  }
  if ("when_to_share" in b) p.when_to_share = String(b.when_to_share || "").trim().slice(0, 1000) || null
  if ("tags" in b) p.tags = (Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",")).map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
  if ("position" in b && Number.isFinite(Number(b.position))) p.position = Math.round(Number(b.position))
  return p
}
