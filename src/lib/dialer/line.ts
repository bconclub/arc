// A person's open line: opening it (dial-in with passcode, or the dialer
// ringing their own phone), dialling the lead that was waiting for it, and
// closing it. SERVER ONLY.
import type { Viewer } from "@/lib/team"
import { e164, hookUrl } from "./config"
import { db, roomFor, type DialerMember } from "./members"
import { esc, hangup, makeCall, speak } from "./vobiz"

const COLS = "id,name,username,active,dialer_phone,dialer_pin_hash,dialer_caller_id"
export const OWNER_USERNAME = "owner-dialer"

/**
 * Who is dialling. A team login is itself. The owner dials as a team_members
 * row of their own ("owner-dialer": no access, a password nobody can match),
 * made the first time it is needed.
 */
export async function actorFor(viewer: Viewer): Promise<DialerMember | null> {
  if (viewer.kind === "team") {
    const { data } = await db.from("team_members").select(COLS).eq("id", viewer.member.id).maybeSingle()
    return (data || null) as DialerMember | null
  }
  const { data: found } = await db.from("team_members").select(COLS).eq("username", OWNER_USERNAME).maybeSingle()
  if (found) return found as DialerMember
  const { data: made } = await db.from("team_members")
    .insert({ name: "Owner", username: OWNER_USERNAME, password_hash: "disabled", role: "sales", active: true, access: [] })
    .select(COLS).single()
  return (made || null) as DialerMember | null
}

/** Mark the line open for this call leg; returns the session id. */
export async function openSession(member: DialerMember, callUuid: string): Promise<string | null> {
  await db.from("dialer_sessions").update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("member_id", member.id).eq("status", "live").neq("agent_call_uuid", callUuid)
  const { data } = await db.from("dialer_sessions").upsert(
    { member_id: member.id, agent_call_uuid: callUuid, room: roomFor(member.id), status: "live", started_at: new Date().toISOString(), ended_at: null },
    { onConflict: "agent_call_uuid" },
  ).select("id").single()
  return data?.id || null
}

/** The XML that holds the person in their room until they hang up. */
export function roomXml(member: DialerMember, greeting: string) {
  return speak(greeting) +
    `<Conference beep="false" stayAlone="true" startConferenceOnEnter="true" endConferenceOnExit="true" callbackUrl="${esc(hookUrl("hangup", { kind: "room" }))}" callbackMethod="POST">${esc(roomFor(member.id))}</Conference>`
}

/** Ring the lead of one call row from the person's company number. */
export async function dialLead(callId: string, from: string, to: string) {
  try {
    const res = await makeCall({ from, to, answerUrl: hookUrl("lead", { c: callId }), hangupUrl: hookUrl("lead-hangup", { c: callId }) })
    await db.from("dialer_calls").update({ request_uuid: res?.request_uuid || null }).eq("id", callId)
    return { ok: true as const }
  } catch (e) {
    const error = (e as Error).message.slice(0, 500)
    await db.from("dialer_calls").update({ status: "failed", ended_at: new Date().toISOString(), error, recording_status: "none", processed_at: new Date().toISOString() }).eq("id", callId)
    return { ok: false as const, error }
  }
}

/** Calls that were waiting for the person's phone to pick up: dial them now. */
export async function dialPending(member: DialerMember, sessionId: string) {
  const since = new Date(Date.now() - 3 * 60_000).toISOString()
  const { data } = await db.from("dialer_calls").select("id,phone,caller_id")
    .eq("member_id", member.id).eq("status", "dialing").is("session_id", null).gt("started_at", since)
    .order("started_at", { ascending: false }).limit(1)
  const c = (data || [])[0] as { id: string; phone: string; caller_id: string | null } | undefined
  if (!c) return
  await db.from("dialer_calls").update({ session_id: sessionId }).eq("id", c.id)
  const from = e164(c.caller_id || member.dialer_caller_id)
  if (from) await dialLead(c.id, from, c.phone)
}

/** The person's phone never picked up: the calls waiting on it did not happen. */
export async function failPending(memberId: string, why: string) {
  await db.from("dialer_calls").update({ status: "failed", ended_at: new Date().toISOString(), error: why, recording_status: "none", processed_at: new Date().toISOString() })
    .eq("member_id", memberId).eq("status", "dialing").is("session_id", null)
}

/** Ring the person's own phone from their company number; answering opens their line. */
export async function ringAgent(member: DialerMember) {
  const from = e164(member.dialer_caller_id), to = e164(member.dialer_phone)
  if (!from) throw new Error("No company number is set for you yet.")
  if (!to) throw new Error("Add your mobile number on the Dialer page first.")
  return makeCall({ from, to, answerUrl: hookUrl("agent", { m: member.id }), hangupUrl: hookUrl("hangup", { m: member.id }) })
}

export async function closeLine(memberId: string) {
  const { data } = await db.from("dialer_sessions").select("id,agent_call_uuid").eq("member_id", memberId).eq("status", "live")
  for (const s of (data || []) as { id: string; agent_call_uuid: string }[]) {
    await hangup(s.agent_call_uuid, null)
    await db.from("dialer_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", s.id)
  }
}
