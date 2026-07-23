import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("payments").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({
      client: body.client || null,
      item: body.item || null,
      amount: body.amount === "" || body.amount == null ? null : Number(body.amount),
      due: body.due || null,
      status: body.status || "pending",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
