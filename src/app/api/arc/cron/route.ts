/**
 * Vercel Cron target — fires on schedule set in vercel.json.
 * Phase 1 (APPROVAL_GATE=human): runs aggregate + evaluate, then stops.
 *   Proposed ideas surface at /dashboard/arc for Z to approve.
 *   Script stage only runs for already-approved ideas.
 * Phase 2 (APPROVAL_GATE=auto): auto-approves top idea, runs full loop.
 */
import { startRun, finishRun, getIdeasByStatus, updateIdeaStatus } from "@/lib/arc/db";
import { NextRequest } from "next/server";

export const maxDuration = 300;

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const GATE = process.env.APPROVAL_GATE ?? "human";

async function callStage(stage: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/arc/pipeline/${stage}`, { method: "POST" });
  if (!res.ok) throw new Error(`${stage} returned ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  // Vercel cron sends GET; protect with cron secret if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const runId = await startRun("full_loop");
  const summary: Record<string, unknown> = {};
  let ok = true;

  try {
    // STAGE 1 — always aggregate
    summary.aggregate = await callStage("aggregate");

    // STAGE 2 — always evaluate
    summary.evaluate = await callStage("evaluate");

    // Phase 1 gate
    if (GATE === "human") {
      const proposed = await getIdeasByStatus("proposed");
      summary.gate = `APPROVAL_GATE=human — ${proposed.length} ideas awaiting review`;
      console.log("[cron]", summary.gate);
    } else {
      // Phase 2: auto-approve top idea
      const proposed = await getIdeasByStatus("proposed");
      if (proposed.length > 0) {
        await updateIdeaStatus(proposed[0].id, "approved");
        summary.auto_approved = proposed[0].id;
      }
    }

    // STAGE 3+4 — script any already-approved ideas (runs in both phases)
    summary.script = await callStage("script");

  } catch (e) {
    console.error("[cron] error:", e);
    summary.error = String(e);
    ok = false;
  }

  await finishRun(runId, summary, ok);
  return Response.json({ ok, summary });
}
