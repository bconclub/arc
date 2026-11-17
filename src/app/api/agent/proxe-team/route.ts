import { NextRequest, NextResponse } from "next/server";
import { checkIngestAuth, authError } from "@/lib/ingest-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GOD's Sales room feed (Z, 16 Nov 2026): who on the PROXe (BCON) team is logged in right now and what they did
 * today. Bearer ARC_INGEST_SECRET. Read-only. ?emails=a@x.com,b@y.com limits the list.
 * online = a dashboard session seen in the last 10 minutes; on_call = a call logged in the last 5 minutes.
 */
type U = { id: string; email: string; full_name: string | null; last_login: string | null };
type S = { user_id: string; last_seen_at: string | null; active_seconds: number | null };
type A = { created_by: string | null; activity_type: string; created_at: string };

async function px<T>(path: string): Promise<T> {
  const url = process.env.PROXE_DB_URL!, key = process.env.PROXE_DB_SERVICE_KEY!;
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!r.ok) throw new Error(`PROXe ${path.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

export async function GET(req: NextRequest) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  if (!process.env.PROXE_DB_URL || !process.env.PROXE_DB_SERVICE_KEY) return NextResponse.json({ error: "PROXe not configured" }, { status: 500 });
  try {
    const emails = (req.nextUrl.searchParams.get("emails") || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    let users = await px<U[]>("dashboard_users?select=id,email,full_name,last_login&is_active=eq.true");
    if (emails.length) users = users.filter((u) => emails.includes(u.email.toLowerCase()));
    const ids = users.map((u) => u.id);
    if (!ids.length) return NextResponse.json({ at: new Date().toISOString(), people: [] });
    const dayStart = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30").toISOString();
    const inList = `(${ids.join(",")})`;
    const [sess, acts] = await Promise.all([
      px<S[]>(`dashboard_user_sessions?select=user_id,last_seen_at,active_seconds&user_id=in.${inList}&last_seen_at=gte.${encodeURIComponent(dayStart)}`),
      px<A[]>(`activities?select=created_by,activity_type,created_at&created_by=in.${inList}&created_at=gte.${encodeURIComponent(dayStart)}`),
    ]);
    const now = Date.now();
    const people = users.map((u) => {
      const s = sess.filter((x) => x.user_id === u.id);
      const a = acts.filter((x) => x.created_by === u.id);
      const seen = s.map((x) => Date.parse(x.last_seen_at || "")).filter(Number.isFinite);
      const lastSeen = seen.length ? Math.max(...seen) : null;
      const calls = a.filter((x) => /call/.test(x.activity_type));
      const lastCall = calls.length ? Math.max(...calls.map((x) => Date.parse(x.created_at))) : null;
      return {
        name: u.full_name || u.email, email: u.email,
        online: lastSeen !== null && now - lastSeen < 10 * 60e3,
        on_call: lastCall !== null && now - lastCall < 5 * 60e3,
        calls: calls.length,
        followups: a.filter((x) => x.activity_type === "followup").length,
        notes: a.filter((x) => x.activity_type === "note").length,
        active_minutes: Math.round(s.reduce((t, x) => t + (x.active_seconds || 0), 0) / 60),
        last: lastSeen ? new Date(lastSeen).toISOString() : u.last_login,
      };
    });
    return NextResponse.json({ at: new Date().toISOString(), people });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
