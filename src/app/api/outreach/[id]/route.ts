import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getViewer } from "@/lib/team";

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

  // Who works the lead. The owner assigns anyone; a team member may only take an
  // unassigned lead or let go of their own.
  if ("owner_id" in body) {
    const next = body.owner_id || null;
    if (next !== null && !/^[0-9a-f-]{36}$/i.test(next)) return NextResponse.json({ error: "Pick a team member." }, { status: 400 });
    const viewer = await getViewer();
    if (viewer?.kind === "team") {
      const { data: cur } = await supabaseAdmin.from("outreach_targets").select("owner_id").eq("id", id).maybeSingle();
      const mine = viewer.member.id, held = cur?.owner_id ?? null;
      const ok = next === mine ? held === null || held === mine : next === null && held === mine;
      if (!ok) return NextResponse.json({ error: "Only the owner can reassign someone else's lead." }, { status: 403 });
    }
    patch.owner_id = next;
  }

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
  if ((await getViewer())?.kind !== "owner") return NextResponse.json({ error: "Only the owner can delete a lead." }, { status: 403 });
  const { error } = await supabaseAdmin.from("outreach_targets").delete().eq("id", ctx.params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
