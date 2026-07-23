import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { error } = await supabaseAdmin.from("brand_metrics").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
