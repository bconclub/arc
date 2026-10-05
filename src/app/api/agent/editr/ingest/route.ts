import { supabaseAdmin } from "@/lib/supabase";
import { authError, checkIngestAuth } from "@/lib/ingest-auth";
import { costUsd } from "@/lib/editr/pricing";

/**
 * Editr sync target. Each machine running the bconclub/editor repo posts its whole current state
 * (`python scripts/tasks.py sync`): token usage per day/agent/model, the video output ledger, and
 * every task's header. Everything is an upsert, so a sync can run any number of times.
 *
 * Machine endpoint: exempt from the session gate via the api/agent prefix in middleware.ts,
 * bearer-checked here with ARC_INGEST_SECRET.
 */

type UsageIn = {
  day: string; agent: string; model: string; speed?: string;
  input: number; output: number; cache_read: number;
  cache_write_5m?: number; cache_write_1h?: number; cache_write?: number; messages: number;
};
type OutputIn = {
  date: string; task: string; agent: string; kind: string; file: string;
  seconds: number; width?: number | string; height?: number | string; brand?: string;
};
type TaskIn = {
  id: string; title: string; brand?: string; project?: string; type?: string; owner?: string;
  status: string; effective?: string; priority?: string; due?: string; blocked_by?: string[];
  waiting_on?: string; drive?: string; output?: string; done_checks?: number; total_checks?: number;
  last_log?: string; path?: string;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const s = (v: unknown) => (v == null || v === "" ? null : String(v));

export async function POST(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);

  let body: { host?: string; usage?: UsageIn[]; outputs?: OutputIn[]; tasks?: TaskIn[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const host = (body.host || auth.agent || "unknown").slice(0, 80);
  const now = new Date().toISOString();
  const result: Record<string, unknown> = { host };

  // Usage: a machine's rows are its complete local history, so they replace, never add.
  if (Array.isArray(body.usage) && body.usage.length) {
    let unpriced = 0;
    const rows = body.usage.map((u) => {
      // Older clients send one combined cache_write; Claude Code writes 1h caches, so treat it as 1h.
      const w5 = n(u.cache_write_5m);
      const w1 = u.cache_write_1h != null ? n(u.cache_write_1h) : n(u.cache_write);
      const c = costUsd({
        model: u.model, speed: u.speed, input: n(u.input), output: n(u.output),
        cache_read: n(u.cache_read), cache_write_5m: w5, cache_write_1h: w1,
      });
      if (!c.priced && u.model !== "<synthetic>") unpriced++;
      return {
        day: u.day, agent: u.agent, host, model: u.model, speed: u.speed || "standard",
        input: n(u.input), output: n(u.output), cache_read: n(u.cache_read),
        cache_write_5m: w5, cache_write_1h: w1, messages: n(u.messages),
        cost_usd: Math.round(c.usd * 10000) / 10000, updated_at: now,
      };
    }).filter((r) => r.day);
    const { error } = await supabaseAdmin.from("editr_usage")
      .upsert(rows, { onConflict: "day,agent,host,model,speed" });
    if (error) return Response.json({ error: `usage: ${error.message}` }, { status: 500 });
    result.usage = rows.length;
    result.unpriced_models = unpriced;
  }

  if (Array.isArray(body.outputs) && body.outputs.length) {
    const rows = body.outputs.map((o) => ({
      id: `${o.task}|${o.kind}|${o.file}`.slice(0, 500),
      date: o.date, task: o.task, agent: o.agent, kind: o.kind, file: o.file,
      seconds: n(o.seconds), width: n(o.width) || null, height: n(o.height) || null, brand: s(o.brand),
    })).filter((r) => r.date && ["final", "draft", "source"].includes(r.kind));
    const { error } = await supabaseAdmin.from("editr_outputs").upsert(rows, { onConflict: "id" });
    if (error) return Response.json({ error: `outputs: ${error.message}` }, { status: 500 });
    result.outputs = rows.length;
  }

  // Tasks: upsert the snapshot, and log an event for every status that changed since last sync.
  if (Array.isArray(body.tasks) && body.tasks.length) {
    const ids = body.tasks.map((t) => t.id).filter(Boolean);
    const { data: prev, error: pe } = await supabaseAdmin.from("editr_tasks")
      .select("id,effective").in("id", ids);
    if (pe) return Response.json({ error: `tasks read: ${pe.message}` }, { status: 500 });
    const before = new Map((prev || []).map((p: { id: string; effective: string }) => [p.id, p.effective]));

    const rows = body.tasks.filter((t) => t.id && t.title).map((t) => ({
      id: t.id, title: t.title, brand: s(t.brand), project: s(t.project), type: s(t.type), owner: s(t.owner),
      status: t.status || "todo", effective: t.effective || t.status || "todo", priority: s(t.priority),
      due: s(t.due), blocked_by: Array.isArray(t.blocked_by) ? t.blocked_by : [], waiting_on: s(t.waiting_on),
      drive: s(t.drive), output: s(t.output), progress_done: n(t.done_checks), progress_total: n(t.total_checks),
      last_log: s(t.last_log), path: s(t.path), updated_at: now,
    }));
    const events = rows
      .filter((r) => before.get(r.id) !== r.effective)
      .map((r) => ({
        task_id: r.id, from_status: before.get(r.id) ?? null, to_status: r.effective,
        note: before.has(r.id) ? r.last_log : `first seen: ${r.last_log ?? ""}`.trim(), host,
      }));
    const { error } = await supabaseAdmin.from("editr_tasks").upsert(rows, { onConflict: "id" });
    if (error) return Response.json({ error: `tasks: ${error.message}` }, { status: 500 });
    if (events.length) {
      const { error: ee } = await supabaseAdmin.from("editr_task_events").insert(events);
      if (ee) return Response.json({ error: `events: ${ee.message}` }, { status: 500 });
    }
    result.tasks = rows.length;
    result.events = events.length;
  }

  return Response.json({ ok: true, ...result });
}
