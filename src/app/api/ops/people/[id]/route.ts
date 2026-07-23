import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "role", "org", "relation", "channel", "notes"]) {
    if (key in body) patch[key] = body[key] === "" ? null : body[key];
  }
  const { data, error } = await supabaseAdmin.from("people").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { error } = await supabaseAdmin.from("people").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
