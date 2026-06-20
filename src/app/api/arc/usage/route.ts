// Config page data: token usage + a quick system status (sources, signals,
// model, approval gate). One GET so the Config page is a single fetch.
import { supabaseAdmin } from "@/lib/supabase";
import { getUsage, resetUsage } from "@/lib/arc/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const usage = await getUsage();

  let sources = 0, activeSources = 0, signals = 0, lastSignalAt: string | null = null;
  try {
    const s = await supabaseAdmin.from("sources").select("active", { count: "exact" });
    sources = s.count || 0;
    activeSources = (s.data || []).filter((r) => r.active).length;
  } catch {}
  try {
    const sig = await supabaseAdmin.from("signals").select("created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1);
    signals = sig.count || 0;
    lastSignalAt = sig.data?.[0]?.created_at as string | null;
  } catch {}

  return Response.json({
    usage,
    status: {
      sources,
      active_sources: activeSources,
      signals,
      last_signal_at: lastSignalAt,
      write_model: "claude-sonnet-4-6",
      idea_model: "claude-haiku-4-5-20251001",
      approval_gate: process.env.APPROVAL_GATE || "human",
    },
  });
}

// Reset the counter (the "Reset" button on Config).
export async function DELETE() {
  await resetUsage();
  return Response.json({ ok: true });
}
