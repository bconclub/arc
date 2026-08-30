// Enqueue work for Luko and any later bot. ARC decides what needs doing;
// workers claim via /api/agent/next. Idempotency keys stop a 6-hourly tick
// from stacking the same draft or image brief while one is still queued.

import { supabaseAdmin } from "@/lib/supabase";

export type EnqueueJob = {
  kind: string;
  payload?: Record<string, unknown>;
  idempotency_key?: string | null;
  priority?: number;
  run_at?: string;
};

export type EnqueueResult =
  | { queued: true; id: string }
  | { queued: false; reason: string };

export async function enqueueJob(job: EnqueueJob): Promise<EnqueueResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("agent_jobs")
    .insert({
      kind: job.kind,
      payload: job.payload ?? {},
      idempotency_key: job.idempotency_key ?? null,
      priority: job.priority ?? 100,
      run_at: job.run_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    const dup = error.code === "23505" || /duplicate|unique/i.test(error.message || "");
    return { queued: false, reason: dup ? "already queued" : error.message };
  }
  return { queued: true, id: String(data.id) };
}
