import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const body = await req.json();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("text" in body) {
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "A task needs some text." }, { status: 400 });
    patch.text = text;
  }
  for (const key of ["due", "project_id", "brand_id"]) {
    if (key in body) patch[key] = body[key] === "" ? null : body[key];
  }
  if ("priority" in body) patch.priority = Number(body.priority) || 0;
  if ("done" in body) {
    patch.done = Boolean(body.done);
    // Stamped here rather than left to the caller, so "done today" is something
    // the data can answer later.
    patch.done_at = body.done ? new Date().toISOString() : null;
  }

  const { data, error } = await supabaseAdmin
    .from("focus_tasks").update(patch).eq("id", ctx.params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { error } = await supabaseAdmin.from("focus_tasks").delete().eq("id", ctx.params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
