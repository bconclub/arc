import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("content_plan")
    .select("*, ideas(id, angle, status), posts(id, status, scheduled_for, published_at, platform)")
    .order("planned_date", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("content_plan")
    .insert({
      title: body.title,
      platform: body.platform || null,
      status: body.status || "idea",
      planned_date: body.planned_date || null,
      idea_id: body.idea_id ?? null,
      post_id: body.post_id ?? null,
      notes: body.notes || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
