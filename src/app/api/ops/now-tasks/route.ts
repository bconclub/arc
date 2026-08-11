import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("now_tasks").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // priority / estimate_minutes are added by the brands_services migration.
  // Only send them when the caller actually supplied a value, so creating a task
  // still works on a database where that migration hasn't been applied yet, // otherwise Postgres rejects the whole insert on the unknown column.
  const row: Record<string, unknown> = {
    text: body.text,
    due: body.due || null,
  };
  if (body.priority) row.priority = body.priority;
  if (body.estimate_minutes !== "" && body.estimate_minutes != null) {
    row.estimate_minutes = Number(body.estimate_minutes);
  }

  const { data, error } = await supabaseAdmin.from("now_tasks").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
