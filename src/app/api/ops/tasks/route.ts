import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Focus tasks. These stand alone: `project_id` and `brand_id` are both optional,
 * so writing a task down never requires inventing a project to hang it off.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("focus_tasks")
    .select("*")
    .order("done", { ascending: true })
    .order("priority", { ascending: false })
    .order("due", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "A task needs some text." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("focus_tasks")
    .insert({
      text,
      due: body.due || null,
      project_id: body.project_id || null,
      brand_id: body.brand_id || null,
      priority: Number(body.priority ?? 0) || 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
