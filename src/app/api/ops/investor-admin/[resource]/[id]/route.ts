import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { RESOURCES, buildRow } from "@/lib/investor/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { resource: string; id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const res = RESOURCES[ctx.params.resource];
  if (!res) return NextResponse.json({ error: "unknown resource" }, { status: 404 });
  const built = await buildRow(res, await req.json().catch(() => ({})), false);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from(res.table).update(built.row).eq("id", ctx.params.id).select(res.select).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** Investors are deactivated, never deleted: their login history is the audit trail. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const res = RESOURCES[ctx.params.resource];
  if (!res) return NextResponse.json({ error: "unknown resource" }, { status: 404 });
  if (res.table === "investors") {
    return NextResponse.json({ error: "Deactivate an investor instead of deleting." }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from(res.table).delete().eq("id", ctx.params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
