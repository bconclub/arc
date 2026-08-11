import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  if ("seen" in body) patch.seen = Boolean(body.seen);
  if ("resolution" in body) patch.resolution = body.resolution || null;
  // Resolving stamps the time; reopening clears it, so resolved_at and seen can
  // never disagree about whether the signal is closed.
  if ("resolved" in body) {
    patch.seen = Boolean(body.resolved);
    patch.resolved_at = body.resolved ? new Date().toISOString() : null;
    if (!body.resolved) patch.resolution = null;
  }

  const { data, error } = await supabaseAdmin
    .from("ops_signals").update(patch).eq("id", id).select().single();

  if (error) {
    // The resolution columns arrive in 20260812110000_signal_resolution.sql.
    // Until it runs, fall back to the seen flag alone rather than failing the
    // action outright: marking something solved should still work.
    if (/resolution|resolved_at/.test(error.message) && "seen" in patch) {
      const retry = await supabaseAdmin
        .from("ops_signals").update({ seen: patch.seen }).eq("id", id).select().single();
      if (!retry.error) {
        return NextResponse.json({
          ...retry.data,
          warning: "Saved, but the resolution note was not stored: run the signal_resolution migration.",
        });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { error } = await supabaseAdmin.from("ops_signals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
