import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

const STATUSES = ["identified", "researched", "drafted", "sent", "replied", "meeting", "won", "lost", "no_reply"];
const KINDS = ["business", "investor", "grant", "citation"];

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  for (const key of ["name", "org", "segment", "city", "email", "phone", "linkedin", "website", "why_them", "research", "source", "notes", "next_at"]) {
    if (key in body) patch[key] = body[key] === "" ? null : body[key];
  }
  if ("status" in body && STATUSES.includes(body.status)) patch.status = body.status;
  if ("kind" in body && KINDS.includes(body.kind)) patch.kind = body.kind;

  const { data, error } = await supabaseAdmin
    .from("outreach_targets").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marking a target sent stamps its newest un-sent outbound draft, so the
  // message history carries the real send moment without a separate call.
  if (patch.status === "sent") {
    const { data: msg } = await supabaseAdmin
      .from("outreach_messages").select("id")
      .eq("target_id", id).eq("direction", "out").is("sent_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (msg) {
      await supabaseAdmin.from("outreach_messages")
        .update({ sent_at: new Date().toISOString() }).eq("id", msg.id);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { error } = await supabaseAdmin.from("outreach_targets").delete().eq("id", ctx.params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
