import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("ideas")
    .select("*, trends(*)")
    .in("status", ["proposed", "approved"])
    .order("fit_score", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ideas: data });
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();

  if (!id || !["approved", "rejected"].includes(status)) {
    return Response.json({ error: "id and status (approved|rejected) required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("ideas")
    .update({ status })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
