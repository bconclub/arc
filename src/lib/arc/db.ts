import { supabaseAdmin } from "@/lib/supabase";

const sb = () => supabaseAdmin;

// ── arc_sources ───────────────────────────────────────────────────────────────

export async function getEnabledSources() {
  const { data } = await sb().from("arc_sources").select("*").eq("enabled", true);
  return data ?? [];
}

// ── trends ────────────────────────────────────────────────────────────────────

export async function upsertTrend(row: {
  source_id: number;
  external_id: string;
  title: string;
  url: string;
  raw: object;
  velocity: number;
}) {
  const { data } = await sb()
    .from("trends")
    .upsert(row, { onConflict: "source_id,external_id", ignoreDuplicates: true })
    .select()
    .limit(1);
  return data?.[0] ?? null;
}

export async function getUnevaluatedTrends(limit = 50) {
  const { data: existing } = await sb().from("ideas").select("trend_id");
  const seen = new Set((existing ?? []).map((r: { trend_id: number }) => r.trend_id));

  const { data } = await sb()
    .from("trends")
    .select("*")
    .order("pulled_at", { ascending: false })
    .limit(limit);

  return (data ?? []).filter((r: { id: number }) => !seen.has(r.id));
}

// ── ideas ─────────────────────────────────────────────────────────────────────

export async function insertIdea(row: {
  trend_id: number;
  fit_score: number;
  rationale: string;
  angle: string;
}) {
  const { data } = await sb()
    .from("ideas")
    .insert({ ...row, status: "proposed" })
    .select()
    .limit(1);
  return data?.[0] ?? null;
}

export async function getIdeasByStatus(status: string) {
  const { data } = await sb()
    .from("ideas")
    .select("*, trends(*)")
    .eq("status", status)
    .order("fit_score", { ascending: false });
  return data ?? [];
}

export async function updateIdeaStatus(id: number, status: string) {
  await sb().from("ideas").update({ status }).eq("id", id);
}

// ── scripts ───────────────────────────────────────────────────────────────────

export async function insertScript(row: {
  idea_id: number;
  hook: string;
  body: string;
  on_screen_text: object[];
  caption: string;
  hashtags: string[];
  shot_list: object[];
}) {
  const { data } = await sb().from("scripts").insert(row).select().limit(1);
  return data?.[0] ?? null;
}

export async function getScriptForIdea(idea_id: number) {
  const { data } = await sb().from("scripts").select("*").eq("idea_id", idea_id).limit(1);
  return data?.[0] ?? null;
}

// ── runs ──────────────────────────────────────────────────────────────────────

export async function startRun(stage: string) {
  const { data } = await sb().from("runs").insert({ stage, ok: null }).select().limit(1);
  return data?.[0]?.id as number;
}

export async function finishRun(run_id: number, summary: object, ok: boolean) {
  await sb()
    .from("runs")
    .update({ finished_at: new Date().toISOString(), summary, ok })
    .eq("id", run_id);
}
