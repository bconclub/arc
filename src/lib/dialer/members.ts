// Who a Vobiz call belongs to. SERVER ONLY.
import { supabaseAdmin } from "@/lib/supabase"
import { tail10 } from "./config"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabaseAdmin as any

export type DialerMember = {
  id: string; name: string; username: string; active: boolean
  dialer_phone: string | null; dialer_pin_hash: string | null; dialer_caller_id: string | null
}
const COLS = "id,name,username,active,dialer_phone,dialer_pin_hash,dialer_caller_id"

async function activeMembers(): Promise<DialerMember[]> {
  const { data } = await db.from("team_members").select(COLS).eq("active", true)
  return (data || []) as DialerMember[]
}

/** The person whose registered mobile this is. */
export async function memberByMobile(phone: string) {
  const t = tail10(phone)
  if (t.length < 10) return null
  return (await activeMembers()).find((m) => tail10(m.dialer_phone) === t) || null
}

/** The person who calls from this company number. */
export async function memberByCallerId(phone: string) {
  const t = tail10(phone)
  if (t.length < 10) return null
  return (await activeMembers()).find((m) => tail10(m.dialer_caller_id) === t) || null
}

/** Everyone who calls from this company number and has a mobile to ring. */
export async function membersByCallerId(phone: string) {
  const t = tail10(phone)
  if (t.length < 10) return []
  return (await activeMembers()).filter((m) => tail10(m.dialer_caller_id) === t && m.dialer_phone)
}

export async function memberById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await db.from("team_members").select(COLS).eq("id", id).eq("active", true).maybeSingle()
  return (data || null) as DialerMember | null
}

export const roomFor = (memberId: string) => `arc_${memberId.replace(/-/g, "").slice(0, 12)}`

/** The ARC lead with this phone: an inbound (PROXe) lead first, then any. */
export async function targetByPhone(phone: string): Promise<{ id: string; proxe_lead_id: string | null } | null> {
  const t = tail10(phone)
  if (t.length < 10) return null
  // Phones are free-form; narrow on the last 4 digits, then match the tail exactly.
  const { data } = await db.from("outreach_targets").select("id,phone,proxe_lead_id,source")
    .ilike("phone", `%${t.slice(-4)}%`).limit(200)
  type Row = { id: string; phone: string; proxe_lead_id: string | null; source: string | null }
  let hits = ((data || []) as Row[]).filter((x) => tail10(x.phone) === t)
  // A number typed with spaces inside its last four digits: read every phone (paged).
  for (let offset = 0; !hits.length && offset < 20000; offset += 1000) {
    const { data: page } = await db.from("outreach_targets").select("id,phone,proxe_lead_id,source")
      .not("phone", "is", null).order("id").range(offset, offset + 999)
    hits = ((page || []) as Row[]).filter((x) => tail10(x.phone) === t)
    if ((page || []).length < 1000) break
  }
  const best = hits.find((x) => x.source === "proxe_inbound") || hits[0]
  return best ? { id: best.id, proxe_lead_id: best.proxe_lead_id } : null
}

/** The person's live line, if they are dialled in. */
export async function liveSession(memberId: string) {
  const since = new Date(Date.now() - 10 * 3600e3).toISOString()
  const { data } = await db.from("dialer_sessions").select("id,agent_call_uuid,room,started_at")
    .eq("member_id", memberId).eq("status", "live").gt("started_at", since)
    .order("started_at", { ascending: false }).limit(1)
  return ((data || [])[0] || null) as { id: string; agent_call_uuid: string; room: string; started_at: string } | null
}
