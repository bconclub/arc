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
type A = { created_by: string | null; activity_type: string; created_at: string; note: string | null; lead_id: string | null; next_follow_up_date: string | null };

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
    const weekStart = new Date(Date.now() - 7 * 864e5).toISOString();
    const [sess, acts, acts7] = await Promise.all([
      px<S[]>(`dashboard_user_sessions?select=user_id,last_seen_at,active_seconds&user_id=in.${inList}&last_seen_at=gte.${encodeURIComponent(dayStart)}`),
      px<A[]>(`activities?select=created_by,activity_type,created_at,note,lead_id,next_follow_up_date&created_by=in.${inList}&created_at=gte.${encodeURIComponent(dayStart)}`),
      px<A[]>(`activities?select=created_by,activity_type,created_at,note,lead_id&created_by=in.${inList}&created_at=gte.${encodeURIComponent(weekStart)}&limit=5000`),
    ]);
    const leadIds = Array.from(new Set(acts.map((x) => x.lead_id).filter(Boolean))) as string[];
    const leads = leadIds.length ? await px<{ id: string; customer_name: string | null; phone: string | null }[]>(`all_leads?select=id,customer_name,phone&id=in.(${leadIds.join(",")})`) : [];
    const leadName = new Map(leads.map((l) => [l.id, l.customer_name || l.phone || ""]));
    const NOPICK = /not picked|no answer|not answer|busy|switched off|not reachable|unreachable|didn'?t pick|did not pick|ringing|wrong number/i;
    const DEMO = /demo|meeting|booked|appointment|call (him|her|them) (at|tomorrow)|tomorrow at|visit/i;
    const now = Date.now();
    // last 24 h and last 7 days (Z, 19 Nov 2026: "see the last 24 hours and last 7 days"); [Connected]/[No Answer] tags from the PROXe dialler win over note words
    const picked = (n: string | null) => /^\s*\[connected\]/i.test(n || "") || (!/^\s*\[/.test(n || "") && !NOPICK.test(n || ""));
    const win = (rows: A[], since: number) => {
      const r = rows.filter((x) => Date.parse(x.created_at) >= since), c = r.filter((x) => /call/.test(x.activity_type));
      return { calls: c.length, connected: c.filter((x) => picked(x.note)).length, demos: c.filter((x) => picked(x.note) && DEMO.test(x.note || "")).length,
        followups: r.filter((x) => x.activity_type === "followup").length, notes: r.filter((x) => x.activity_type === "note").length,
        leads: new Set(r.map((x) => x.lead_id).filter(Boolean)).size,
        // calls made on their own phone and logged by hand in PROXe (not through the ARC dialer) (Z, 23 Nov 2026: Aftab's calls didn't show)
        manual_calls: r.filter((x) => x.activity_type === "manual_call").length,
        manual_connected: r.filter((x) => x.activity_type === "manual_call" && picked(x.note)).length };
    };
    const people = users.map((u) => {
      const s = sess.filter((x) => x.user_id === u.id);
      const a = acts.filter((x) => x.created_by === u.id);
      const seen = s.map((x) => Date.parse(x.last_seen_at || "")).filter(Number.isFinite);
      const lastSeen = seen.length ? Math.max(...seen) : null;
      const calls = a.filter((x) => /call/.test(x.activity_type));
      const lastCall = calls.length ? Math.max(...calls.map((x) => Date.parse(x.created_at))) : null;
      return {
        name: u.full_name || u.email, email: u.email,
        today: win(acts7.filter((x) => x.created_by === u.id), Date.parse(dayStart)),
        h24: win(acts7.filter((x) => x.created_by === u.id), now - 864e5),
        d7: win(acts7.filter((x) => x.created_by === u.id), now - 7 * 864e5),
        online: lastSeen !== null && now - lastSeen < 10 * 60e3,
        on_call: lastCall !== null && now - lastCall < 5 * 60e3,
        calls: calls.length,
        picked_up: calls.filter((x) => !NOPICK.test(x.note || "")).length,
        demos: calls.filter((x) => DEMO.test(x.note || "") && !NOPICK.test(x.note || "")).length,
        leads_touched: new Set(a.map((x) => x.lead_id).filter(Boolean)).size,
        recent: a.slice().sort((p, q) => Date.parse(q.created_at) - Date.parse(p.created_at)).slice(0, 10).map((x) => ({
          at: x.created_at, type: x.activity_type, lead: leadName.get(x.lead_id || "") || "", note: (x.note || "").slice(0, 120), next: x.next_follow_up_date })),
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
