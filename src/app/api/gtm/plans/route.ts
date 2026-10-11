import { supabaseAdmin } from "@/lib/supabase";

/**
 * GTM plans and the brief, in one read. Owner only (session-gated by middleware).
 * Plans: one per channel, each with its steps (done = where we stand, open =
 * what's missing). Brief: offer, buyer, win, motion, channels, source of truth,
 * approval rules, kept in arc_context 'gtm_brief'.
 */
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

export async function GET() {
  const [plans, brief] = await Promise.all([
    db.from("gtm_plans").select("*").order("ord"),
    db.from("arc_context").select("value,updated_at").eq("key", "gtm_brief").maybeSingle(),
  ]);
  if (plans.error) return Response.json({ error: plans.error.message }, { status: 500 });
  let b = null;
  try { b = brief.data?.value ? JSON.parse(brief.data.value) : null; } catch { /* malformed brief: show none */ }
  return Response.json({ plans: plans.data, brief: b, brief_updated_at: brief.data?.updated_at ?? null });
}

/** Save the brief (the whole object). */
export async function PUT(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) return Response.json({ error: "Send the brief as an object." }, { status: 400 });
  const keep = ["offer", "buyer", "win", "motion", "channels", "truth"] as const;
  const brief: Record<string, unknown> = {};
  for (const k of keep) brief[k] = String(b[k] ?? "").slice(0, 2000);
  brief.rules = (Array.isArray(b.rules) ? b.rules : []).map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 20);
  const now = new Date().toISOString();
  const { error } = await db.from("arc_context").upsert({ key: "gtm_brief", value: JSON.stringify(brief), updated_at: now });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ brief, brief_updated_at: now });
}
