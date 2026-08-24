import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Sends (or dry-runs) a WhatsApp message to this target THROUGH PROXe's
 * outbound intent endpoint - ARC never talks to Meta itself. PROXe decides
 * the 24h-window mode (free text vs approved template), creates the lead on
 * first send with our attribution attached, and threads every reply into its
 * own inbox. This call is the exact moment a prospect stops being ARC's and
 * becomes a PROXe conversation.
 *
 * Body: { text?, template?, params?, dry_run? } - at least text or template.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const base = process.env.PROXE_INTENT_BASE;
  const key = process.env.PROXE_INBOUND_API_KEY;
  if (!base || !key) {
    return NextResponse.json(
      { error: "PROXE_INTENT_BASE / PROXE_INBOUND_API_KEY not configured" },
      { status: 501 },
    );
  }

  const { id } = ctx.params;
  const body = await req.json().catch(() => ({}));

  const { data: target, error } = await supabaseAdmin
    .from("outreach_targets").select("*").eq("id", id).single();
  if (error || !target) return NextResponse.json({ error: "target not found" }, { status: 404 });
  if (!target.phone) return NextResponse.json({ error: "target has no phone" }, { status: 400 });

  const payload = {
    phone: target.phone,
    text: typeof body.text === "string" ? body.text : undefined,
    template: typeof body.template === "string" ? body.template : undefined,
    params: Array.isArray(body.params) ? body.params : undefined,
    dry_run: body.dry_run === true,
    name: target.name,
    source: "arc_outreach",
    context: {
      org: target.org || undefined,
      city: target.city || undefined,
      segment: target.segment || undefined,
      note: target.why_them || undefined,
      research: target.research || undefined,
    },
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/agent/outreach/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json({ error: `PROXe unreachable: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }
  const result = await upstream.json().catch(() => ({}));

  // Book-keep on the ARC side only for REAL sends that went out.
  if (!payload.dry_run && upstream.ok && result?.sent) {
    await supabaseAdmin.from("outreach_messages").insert({
      target_id: id,
      direction: "out",
      channel: "whatsapp",
      body: payload.text || `[template] ${payload.template ?? ""}`,
      sent_at: new Date().toISOString(),
    });
    if (["identified", "researched", "drafted"].includes(target.status)) {
      await supabaseAdmin.from("outreach_targets").update({ status: "sent" }).eq("id", id);
    }
  }

  return NextResponse.json({ proxe: result, status: upstream.status }, { status: upstream.ok ? 200 : upstream.status });
}
