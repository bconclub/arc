import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("ops_signals").select("*").order("ts", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("ops_signals")
    .insert({
      source: body.source || null,
      title: body.title,
      detail: body.detail || null,
      severity: body.severity || "info",
      url: body.url || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
