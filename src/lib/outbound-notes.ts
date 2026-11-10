// The shared log for the AI callers (outbound_notes): Z's feedback, what the calls
// teach, every caller change and what is still broken. Read by
// /dashboard/outreach/callers, written from there and by agents through
// /api/agent/outreach/notes.
import { tdb } from "@/lib/team"

export const NOTE_KINDS = [
  { key: "feedback", label: "Z's feedback", blurb: "What Z said about the calls, in his words." },
  { key: "learning", label: "What the calls teach", blurb: "Patterns from real calls: what gets through and where people drop." },
  { key: "issue", label: "Open problems", blurb: "What is still broken, until someone marks it fixed." },
  { key: "change", label: "Changes made", blurb: "Every edit to a caller or the dial flow: what, why, and where the old version is." },
] as const
export type NoteKind = (typeof NOTE_KINDS)[number]["key"]
export const isKind = (k: unknown): k is NoteKind => NOTE_KINDS.some((x) => x.key === k)

export type OutboundNote = {
  id: string; kind: NoteKind; caller: string | null; body: string; action: string | null; author: string
  call_id: string | null; noted_on: string; resolved_at: string | null; source: string; external_id: string | null
  created_at: string; updated_at: string
}

export async function listNotes(): Promise<OutboundNote[]> {
  const { data, error } = await tdb.from("outbound_notes").select("*").order("noted_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000)
  if (error) throw new Error(error.message)
  return (data || []) as OutboundNote[]
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

/** Whitelist a note from a request body (the page or an agent). Returns an error string when it can't be saved. */
export function notePatch(b: Record<string, unknown>, partial: boolean): Record<string, unknown> | string {
  const p: Record<string, unknown> = {}
  if ("kind" in b || !partial) {
    if (!isKind(b.kind)) return "Pick what kind of note this is."
    p.kind = b.kind
  }
  if ("body" in b || !partial) {
    const body = clip(b.body, 4000)
    if (!body) return "Write the note."
    p.body = body
  }
  if ("caller" in b) p.caller = clip(b.caller, 60) || null
  if ("action" in b) p.action = clip(b.action, 2000) || null
  if ("author" in b) { const a = clip(b.author, 60); if (a) p.author = a }
  if ("call_id" in b) {
    const id = clip(b.call_id, 80)
    if (id && !/^conv_[a-z0-9]+$/i.test(id)) return "Call id must look like conv_…"
    p.call_id = id || null
  }
  if ("noted_on" in b) {
    const d = clip(b.noted_on, 10)
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Date must be YYYY-MM-DD."
    if (d) p.noted_on = d
  }
  if ("resolved" in b) p.resolved_at = b.resolved ? new Date().toISOString() : null
  return p
}

/** Everything in the log as plain text, for an agent to read before it touches a caller. */
export function notesAsText(notes: OutboundNote[]): string {
  return NOTE_KINDS.map((k) => {
    const rows = notes.filter((n) => n.kind === k.key && !(k.key === "issue" && n.resolved_at))
    if (!rows.length) return ""
    return `## ${k.label}\n` + rows.map((n) => `- ${n.noted_on}${n.caller ? ` [${n.caller}]` : ""} (${n.author}) ${n.body}${n.action ? ` -> ${n.action}` : ""}`).join("\n")
  }).filter(Boolean).join("\n\n")
}
