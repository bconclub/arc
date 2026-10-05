import { supabaseAdmin } from "@/lib/supabase";

/**
 * Everything the Editr page shows, in one read. Session-gated like every /api/ops route.
 * Usage and outputs are small (one row per day/agent/model, one per rendered file), so the page
 * gets all of it and aggregates client-side.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [usage, outputs, tasks, events, spend] = await Promise.all([
    supabaseAdmin.from("editr_usage").select("*").order("day", { ascending: true }),
    supabaseAdmin.from("editr_outputs").select("*").order("date", { ascending: false }),
    supabaseAdmin.from("editr_tasks").select("*"),
    supabaseAdmin.from("editr_task_events").select("*").order("at", { ascending: false }).limit(300),
    supabaseAdmin.from("expenses").select("spent_on,created_at,amount,currency,description,recurring")
      .ilike("vendor", "%anthropic%").order("created_at", { ascending: false }),
  ]);
  const err = [usage, outputs, tasks, events, spend].find((r) => r.error)?.error;
  if (err) return Response.json({ error: err.message }, { status: 500 });
  return Response.json({
    usage: usage.data, outputs: outputs.data, tasks: tasks.data,
    events: events.data, anthropicSpend: spend.data,
  });
}
