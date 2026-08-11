import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json();
  // GST/billing columns (gstin, place_of_supply, currency, lifetime_revenue…)
  // are owned by the billing side and intentionally not patchable from the dashboard.
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "logo_url", "color", "status", "kind", "via_brand_id", "notes", "aliases", "domains", "github_repos"]) {
    if (key in body) patch[key] = body[key] === "" ? null : body[key];
  }
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("brands").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { error } = await supabaseAdmin.from("brands").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
