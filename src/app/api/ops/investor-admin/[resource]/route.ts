import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { RESOURCES, buildRow } from "@/lib/investor/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { resource: string } };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const res = RESOURCES[ctx.params.resource];
  if (!res) return NextResponse.json({ error: "unknown resource" }, { status: 404 });
  const { data, error } = await supabaseAdmin
    .from(res.table).select(res.select).order(res.order, { ascending: false }).limit(300);
  if (error) {
    const detail = /schema cache|does not exist/i.test(error.message)
      ? "Run 20261003000000_investor_portal.sql to enable the investor portal."
      : error.message;
    return NextResponse.json({ items: [], detail });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const res = RESOURCES[ctx.params.resource];
  if (!res) return NextResponse.json({ error: "unknown resource" }, { status: 404 });
  const built = await buildRow(res, await req.json().catch(() => ({})), true);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from(res.table).insert(built.row).select(res.select).single();
  if (error) {
    const dup = /duplicate key/i.test(error.message) ? "That username is taken." : error.message;
    return NextResponse.json({ error: dup }, { status: 400 });
  }
  return NextResponse.json(data, { status: 201 });
}
