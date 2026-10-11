import { supabaseAdmin } from "@/lib/supabase";

/** Update one GTM plan: status, numbers, next action, notes, steps (tick off what's missing). Owner only. */
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;
const STATUSES = ["not_started", "building", "live", "paused"];
const TEXT = ["why", "metric", "target", "current", "cadence", "owner", "next_action", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const k of TEXT) if (typeof b[k] === "string") patch[k] = b[k].slice(0, 4000);
  if (STATUSES.includes(b.status)) patch.status = b.status;
  if (Array.isArray(b.steps)) {
    patch.steps = b.steps
      .map((s: { text?: unknown; done?: unknown }) => ({ text: String(s?.text ?? "").trim().slice(0, 500), done: Boolean(s?.done) }))
      .filter((s: { text: string }) => s.text)
      .slice(0, 40);
  }
  for (const k of ["tools", "guardrails"] as const) {
    if (Array.isArray(b[k])) patch[k] = b[k].map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 20);
  }
  if (!Object.keys(patch).length) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { data, error } = await db.from("gtm_plans").update(patch).eq("slug", params.slug).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ plan: data });
}
