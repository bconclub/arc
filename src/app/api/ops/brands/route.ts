import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPatch, patchError } from "@/lib/ops-fields";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// The writable-column list lives in lib/ops-fields.ts, shared with the PATCH
// route — it used to exist twice with different contents, which is how lists
// drift. GST/billing columns stay deliberately unwritable from the dashboard.

export async function GET() {
  const { data, error } = await supabaseAdmin.from("brands").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const res = buildPatch("brands", body);
  if (!res.ok) return NextResponse.json(patchError(res), { status: 400 });
  const row = { ...res.patch, name: String(body.name).trim() };
  const { data, error } = await supabaseAdmin.from("brands").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
