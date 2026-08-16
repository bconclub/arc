import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPatch, patchError } from "@/lib/ops-fields";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("payments").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = buildPatch("payments", body);
  if (!res.ok) return NextResponse.json(patchError(res), { status: 400 });
  const row = { status: "pending", ...res.patch };
  const { data, error } = await supabaseAdmin.from("payments").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
