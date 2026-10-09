// Team logins, server side: who is looking (owner or a team member), and the
// small shared reads the /team pages and the owner's Team page both use.
import { cookies } from "next/headers";
import { COOKIE_NAME, TEAM_COOKIE, verifySessionToken, verifyTeamToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export type TeamMember = {
  id: string; name: string; username: string; role: string; active: boolean
  last_login_at: string | null; created_at: string
}
export type Viewer = { kind: "owner" } | { kind: "team"; member: TeamMember }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tdb = supabaseAdmin as any
const PUBLIC_COLS = "id,name,username,role,active,last_login_at,created_at"

/** The owner session wins; otherwise an active team member; otherwise null. */
export async function getViewer(): Promise<Viewer | null> {
  const jar = cookies()
  try {
    if (await verifySessionToken(jar.get(COOKIE_NAME)?.value)) return { kind: "owner" }
  } catch { /* no SESSION_SECRET: fall through */ }
  const id = await verifyTeamToken(jar.get(TEAM_COOKIE)?.value).catch(() => null)
  if (!id) return null
  const { data } = await tdb.from("team_members").select(PUBLIC_COLS).eq("id", id).eq("active", true).maybeSingle()
  return data ? { kind: "team", member: data as TeamMember } : null
}

export async function listMembers(includeInactive = false): Promise<TeamMember[]> {
  let q = tdb.from("team_members").select(PUBLIC_COLS).order("created_at")
  if (!includeInactive) q = q.eq("active", true)
  const { data } = await q
  return (data || []) as TeamMember[]
}

export const forbidden = (msg = "Not available for this login.") => Response.json({ error: msg }, { status: 403 })
export const unauthorized = () => Response.json({ error: "Sign in again." }, { status: 401 })

/**
 * The `worker` label an activity row records: the member's login name (it never
 * changes, unlike their display name), or "manual" for the owner.
 */
export const workerLabel = (v: Viewer | null) => (v?.kind === "team" ? v.member.username : "manual")
