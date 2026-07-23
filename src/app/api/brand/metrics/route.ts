import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("brand_metrics")
    .select("*")
    .order("recorded_on", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const num = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const { data, error } = await supabaseAdmin
    .from("brand_metrics")
    .upsert(
      {
        platform: body.platform,
        recorded_on: body.recorded_on || new Date().toISOString().slice(0, 10),
        followers: num(body.followers),
        reach: num(body.reach),
        engagement: num(body.engagement),
        notes: body.notes || null,
      },
      { onConflict: "platform,recorded_on" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
