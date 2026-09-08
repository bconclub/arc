// Always-on GTM tick. Refreshes listening context, fills proposed ideas when
// the board is empty, and enqueues draft/image jobs for work a human already
// approved. Does not publish. Does not spend Tavily. Does not invent images.

import { supabaseAdmin } from "@/lib/supabase";
import { syncAllSources, type PullResult } from "@/lib/arc/context-sources";
import { regenerateProposedIdeas } from "@/lib/arc/ideas";
import { enqueueJob } from "@/lib/arc/jobs";
import { writeContext, ttl } from "@/lib/arc/agent-context";
import { listKeywords } from "@/lib/market";

export type TickResult = {
  ok: boolean;
  sources: PullResult[];
  ideas_filled: number;
  ideas_error: string | null;
  jobs_enqueued: Array<{ kind: string; key: string; queued: boolean; reason?: string }>;
};

async function loadUsePhrases(): Promise<string[]> {
  const bank = await listKeywords();
  if ("error" in bank) return [];
  return bank.rows.filter((r) => r.status === "use").slice(0, 12).map((r) => r.phrase);
}

async function proposedCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("ideas")
    .select("id", { count: "exact", head: true })
    .eq("status", "proposed");
  return count ?? 0;
}

type IdeaRow = {
  id: number;
  angle: string | null;
  trends: { title?: string } | { title?: string }[] | null;
};

function trendTitle(row: IdeaRow): string {
  const t = Array.isArray(row.trends) ? row.trends[0] : row.trends;
  return t?.title || row.angle || `idea ${row.id}`;
}

async function enqueueContentJobs(keywords: string[]): Promise<TickResult["jobs_enqueued"]> {
  const out: TickResult["jobs_enqueued"] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;

  const { data: approved } = await sb
    .from("ideas")
    .select("id, angle, trends(title)")
    .eq("status", "approved")
    .order("fit_score", { ascending: false })
    .limit(20);

  const ideas = (approved ?? []) as IdeaRow[];
  if (!ideas.length) return out;

  const { data: scripts } = await sb
    .from("scripts")
    .select("id, idea_id, hook, caption");
  const byIdea = new Map<number, { id: number; hook: string; caption: string }>();
  for (const s of scripts ?? []) {
    byIdea.set(Number(s.idea_id), {
      id: Number(s.id),
      hook: String(s.hook || ""),
      caption: String(s.caption || ""),
    });
  }

  const { data: assets } = await sb.from("assets").select("id, script_id");
  const scriptHasAsset = new Set((assets ?? []).map((a: { script_id: number }) => Number(a.script_id)));

  for (const idea of ideas) {
    const script = byIdea.get(Number(idea.id));
    const title = trendTitle(idea);

    if (!script) {
      const key = `draft_content:${idea.id}`;
      const res = await enqueueJob({
        kind: "draft_content",
        priority: 50,
        idempotency_key: key,
        payload: {
          idea_id: idea.id,
          title,
          angle: idea.angle || "",
          keywords,
          format: "script",
        },
      });
      out.push({
        kind: "draft_content",
        key,
        queued: res.queued,
        reason: res.queued ? undefined : res.reason,
      });
      continue;
    }

    if (scriptHasAsset.has(script.id)) continue;

    const key = `render_image:blog:${idea.id}`;
    const res = await enqueueJob({
      kind: "render_image",
      priority: 60,
      idempotency_key: key,
      payload: {
        idea_id: idea.id,
        script_id: script.id,
        title,
        hook: script.hook,
        caption: script.caption,
        use: "blog",
        prompt: `Blog hero for BCON Club / PROXe. Topic: ${title}. ICP: Indian clinics, coaching academies, real estate, tutoring. No fake logos, no unreadable text, no stock-handshake cliche.`,
      },
    });
    out.push({
      kind: "render_image",
      key,
      queued: res.queued,
      reason: res.queued ? undefined : res.reason,
    });
  }

  return out;
}

export async function runTick(opts: { fillIdeas?: boolean } = {}): Promise<TickResult> {
  const sources = await syncAllSources();

  let ideas_filled = 0;
  let ideas_error: string | null = null;
  const empty = (await proposedCount()) === 0;
  const shouldFill = opts.fillIdeas === true || empty;

  if (shouldFill) {
    try {
      ideas_filled = await regenerateProposedIdeas(8);
    } catch (e) {
      ideas_error = e instanceof Error ? e.message : "Idea generation failed.";
      console.error("[tick] idea generation failed:", e);
    }
  }

  const keywords = await loadUsePhrases();
  const jobs_enqueued = await enqueueContentJobs(keywords);

  const queued = jobs_enqueued.filter((j) => j.queued).length;
  const payload = {
    at: new Date().toISOString(),
    sources: sources.map((s) => ({ namespace: s.namespace, ok: s.ok, detail: s.detail })),
    ideas_filled,
    ideas_error,
    jobs_enqueued: queued,
  };

  const summary = [
    `GTM tick at ${payload.at}.`,
    `Sources: ${sources.filter((s) => s.ok).length}/${sources.length} ok.`,
    ideas_error
      ? `Idea fill failed: ${ideas_error}`
      : ideas_filled
        ? `Filled ${ideas_filled} proposed ideas.`
        : shouldFill
          ? "Idea fill ran, nothing to write (empty feed or model returned none)."
          : "Proposed ideas already on the board, left them.",
    `Enqueued ${queued} content job(s) for approved work. Nothing published.`,
  ].join(" ");

  await writeContext({
    namespace: "gtm",
    scope: "global",
    payload,
    summary_md: summary,
    source: "arc/tick",
    expires_at: ttl(360),
  });

  return {
    ok: sources.every((s) => s.ok) && !ideas_error,
    sources,
    ideas_filled,
    ideas_error,
    jobs_enqueued,
  };
}
