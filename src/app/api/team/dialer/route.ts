import { getViewer, unauthorized } from "@/lib/team";
import { vobizConfigured } from "@/lib/dialer/config";
import { db, liveSession } from "@/lib/dialer/members";
import { sweep } from "@/lib/dialer/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Row = { target_id: string | null; target_name?: string | null; recording_key?: string | null; has_recording?: boolean };

/** Lead names for the list, and no storage keys to the browser. */
async function named<T extends Row>(rows: T[]): Promise<T[]> {
  const ids = Array.from(new Set(rows.map((r) => r.target_id).filter(Boolean))) as string[];
  const { data } = ids.length ? await db.from("outreach_targets").select("id,name").in("id", ids) : { data: [] };
  const names = new Map(((data || []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));
  return rows.map((r) => {
    const { recording_key, ...rest } = r;
    return { ...rest, has_recording: Boolean(recording_key), target_name: r.target_id ? names.get(r.target_id) || null : null } as T;
  });
}

const CALL_COLS = "id,member_id,target_id,direction,phone,caller_id,status,hangup_cause,started_at,answered_at,ended_at,duration_secs,recording_status,recording_key,note,fields,outcome,processed_at,proxe_synced_at,proxe_error,error";

/**
 * Dialer state for the signed-in person: is their line open, their calls (36 h, or ?days=N)
 * (newest first, the live one on top). The owner sees everyone's setup and calls.
 * Each read also runs the backstop sweep (unfiled calls, missing recordings).
 */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const swept = sweep().catch((e) => console.error("[dialer] sweep", (e as Error).message));

  // Before the team dialer migration runs, say so instead of failing every read.
  const probe = await db.from("dialer_calls").select("id").limit(1);
  if (probe.error) return Response.json({ role: viewer.kind, configured: false, installed: false, calls: [] });
  await swept;

  // ?days=N widens the list (the Calls page reads 30 days); the bar reads the last 36 hours.
  const days = Math.min(60, Math.max(0, Number(new URL(req.url).searchParams.get("days")) || 0));
  const since = new Date(Date.now() - (days ? days * 24 : 36) * 3600e3).toISOString();
  const cap = days ? 500 : 0;
  if (viewer.kind === "team") {
    const m = viewer.member;
    const { data: me } = await db.from("team_members").select("dialer_phone,dialer_caller_id,dialer_pin_hash").eq("id", m.id).maybeSingle();
    const session = await liveSession(m.id);
    const { data: calls } = await db.from("dialer_calls").select(CALL_COLS).eq("member_id", m.id).gt("started_at", since)
      .order("started_at", { ascending: false }).limit(cap || 40);
    return Response.json({
      role: "team",
      configured: vobizConfigured(),
      me: {
        id: m.id, name: m.name,
        mobile: me?.dialer_phone || null, number: me?.dialer_caller_id || null, pin_set: Boolean(me?.dialer_pin_hash),
      },
      live: session ? { since: session.started_at } : null,
      calls: await named(calls || []),
    });
  }

  const { data: members } = await db.from("team_members").select("id,name,dialer_phone,dialer_caller_id,dialer_pin_hash").eq("active", true).order("created_at");
  const { data: sessions } = await db.from("dialer_sessions").select("member_id,started_at").eq("status", "live");
  const { data: calls } = await db.from("dialer_calls").select(CALL_COLS).gt("started_at", since)
    .order("started_at", { ascending: false }).limit(cap || 100);
  return Response.json({
    role: "owner",
    configured: vobizConfigured(),
    members: ((members || []) as { id: string; name: string; dialer_phone: string | null; dialer_caller_id: string | null; dialer_pin_hash: string | null }[])
      .map((x) => ({
        id: x.id, name: x.name, mobile: x.dialer_phone, number: x.dialer_caller_id, pin_set: Boolean(x.dialer_pin_hash),
        live: ((sessions || []) as { member_id: string }[]).some((s) => s.member_id === x.id),
      })),
    calls: await named(calls || []),
  });
}
