// Autowire feed sync. Hit by Vercel Cron on a schedule (and callable manually).
// Pulls every active RSS source in-process and rewrites the signals cache, so
// the Feed page always loads fresh content instantly from cache, no waiting on
// a live fetch, and no internal HTTP hop that deployment protection would block.
import { supabaseAdmin } from "@/lib/supabase";
import { fetchFeeds, itemsToSignals, writeSignalsCache } from "@/lib/arc/rss";
import { regenerateProposedIdeas } from "@/lib/arc/ideas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runSync() {
  const { data: sources, error } = await supabaseAdmin
    .from("sources")
    .select("value")
    .eq("active", true)
    .eq("type", "rss");

  if (error) return { ok: false, error: error.message };

  const urls = (sources || []).map((s) => s.value as string).filter(Boolean);
  if (urls.length === 0) return { ok: true, sources: 0, fetched: 0, cached: 0 };

  // ogFallback off: cron stays well under the time limit; cards without a feed
  // image fall back to the source-logo placeholder in the UI.
  const items = await fetchFeeds(urls, { ogFallback: false });
  const signals = itemsToSignals(items).sort((a, b) => b.trend_score - a.trend_score).slice(0, 150);
  const cached = await writeSignalsCache(signals);

  // Auto-generate top ideas from the fresh signals (cheap Haiku call).
  let ideas = 0;
  let ideasError: string | null = null;
  try {
    ideas = await regenerateProposedIdeas(8);
  } catch (e) {
    // Swallowing this made a dead API key look like a healthy cron: signals
    // kept writing nightly while ideas silently stopped for two days. The feed
    // sync still succeeds, since fresh signals are worth having on their own,
    // but the failure is now recorded where it will actually be seen.
    ideasError = e instanceof Error ? e.message : "Idea generation failed.";
    console.error("[sync] idea generation failed:", e);
    await supabaseAdmin.from("ops_signals").insert({
      source: "arc-sync",
      title: "Nightly idea generation is failing",
      detail: ideasError,
      severity: "high",
      seen: false,
    }).then(({ error }) => { if (error) console.error("[sync] could not record the failure:", error.message); });
  }

  return { ok: true, sources: urls.length, fetched: items.length, cached, ideas, ideasError };
}

// Vercel Cron sends GET. Optionally protect with CRON_SECRET if set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await runSync();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(req: Request) {
  return GET(req);
}
