import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ runs: data });
}
