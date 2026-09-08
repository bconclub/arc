import { supabaseAdmin } from "@/lib/supabase";
import { callSession } from "@/lib/outreach-calls";
import { isTestTarget } from "@/lib/outreach-workflow";
export const dynamic = "force-dynamic";
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await callSession()))
    return Response.json(
      { error: "Sign in to hand off contacts." },
      { status: 401 },
    );
  const { data: t, error } = await supabaseAdmin
    .from("outreach_targets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "Could not check qualification." },
      { status: 503 },
    );
  if (
    !t?.qualified_at ||
    !t.qualification_note ||
    t.kind !== "business" ||
    isTestTarget(t)
  )
    return Response.json(
      { error: "Qualify this prospect before handing it to PROXe." },
      { status: 409 },
    );
  const base = process.env.PROXE_INTENT_BASE,
    key = process.env.PROXE_INBOUND_API_KEY;
  if (!base || !key)
    return Response.json(
      { error: "PROXe handoff is not configured." },
      { status: 503 },
    );
  try {
    const r = await fetch(
      base.replace(/\/$/, "") + "/api/agent/outreach/promote",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({ target_id: t.id }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const d = await r.json();
    if (!r.ok)
      return Response.json(
        { error: d.error || "Handoff failed." },
        { status: r.status },
      );
    const { error: saveError } = await supabaseAdmin
      .from("outreach_targets")
      .update({
        promoted_at: new Date().toISOString(),
        proxe_lead_id: d.lead_id,
      })
      .eq("id", t.id);
    return Response.json({
      ok: true,
      lead_id: d.lead_id,
      warning: saveError
        ? "Contact handed off, but ARC could not save its handoff marker. Refresh and retry handoff; do not send a message again."
        : null,
    });
  } catch {
    return Response.json(
      {
        error:
          "PROXe handoff unavailable. Retry; existing contacts will be matched.",
      },
      { status: 503 },
    );
  }
}
