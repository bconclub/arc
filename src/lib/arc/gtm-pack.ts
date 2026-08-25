// The GTM pack bots pull. One document: ICP, the use-keyword bank, the latest
// market snapshot, proposed/approved ideas, queued content jobs, and which
// workers last heartbeated. SERVER ONLY.

import { supabaseAdmin } from "@/lib/supabase";
import { PROXE_ICP } from "@/lib/icp";
import { listKeywords } from "@/lib/market";
import { readContext } from "@/lib/arc/agent-context";

export type GtmPack = {
  generated_at: string;
  icp: typeof PROXE_ICP;
  keywords_use: Array<{
    phrase: string;
    cluster: string;
    vertical: string;
    rank_score: number;
    hits: number;
  }>;
  market_md: string;
  ideas: Array<{
    id: number;
    status: string;
    fit_score: number;
    angle: string;
    title: string;
  }>;
  jobs: Array<{
    id: string;
    kind: string;
    status: string;
    run_at: string;
    idempotency_key: string | null;
  }>;
  workers: Array<{
    agent: string;
    last_seen: string | null;
    stale: boolean | null;
    note: string | null;
  }>;
  last_tick: Record<string, unknown> | null;
  contract: {
    pull: string;
    next: string;
    tick: string;
    conversation: string;
    ownership: string;
  };
};

const CONTRACT = {
  pull: "GET /api/agent/gtm?format=md  Authorization: Bearer $ARC_INGEST_SECRET",
  next: "POST /api/agent/next  { kinds: [\"draft_content\",\"render_image\"] }",
  tick: "GET /api/arc/tick  (cron, Bearer $CRON_SECRET) or POST from a session",
  conversation: "POST /api/proxe/conversation  Authorization: Bearer $ARC_INGEST_SECRET",
  ownership:
    "ARC owns prospects until the first two-way contact. After that PROXe owns the conversation and reports it here so the outreach board stays in sync. Nothing auto-publishes. Ideas stay proposed until a human approves them.",
};

export async function buildGtmPack(): Promise<GtmPack> {
  const generated_at = new Date().toISOString();

  const bank = await listKeywords();
  const keywords_use =
    "error" in bank
      ? []
      : bank.rows
          .filter((r) => r.status === "use")
          .slice(0, 20)
          .map((r) => ({
            phrase: r.phrase,
            cluster: r.cluster,
            vertical: r.vertical,
            rank_score: r.rank_score,
            hits: r.hits,
          }));

  const ctx = await readContext({ namespaces: ["market", "icp_keywords", "gtm", "meta_ads"] });
  const blocks = "error" in ctx ? [] : ctx.blocks;
  const market = blocks.find((b) => b.namespace === "market");
  const gtm = blocks.find((b) => b.namespace === "gtm");
  const market_md = [market?.summary_md, blocks.find((b) => b.namespace === "icp_keywords")?.summary_md]
    .filter((s) => s && s.trim())
    .join("\n\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;

  const { data: ideaRows } = await sb
    .from("ideas")
    .select("id, status, fit_score, angle, trends(title)")
    .in("status", ["proposed", "approved"])
    .order("fit_score", { ascending: false })
    .limit(24);

  const ideas = (ideaRows ?? []).map((row: {
    id: number;
    status: string;
    fit_score: number;
    angle: string;
    trends: { title?: string } | { title?: string }[] | null;
  }) => {
    const trend = Array.isArray(row.trends) ? row.trends[0] : row.trends;
    return {
      id: row.id,
      status: row.status,
      fit_score: Number(row.fit_score) || 0,
      angle: row.angle || "",
      title: trend?.title || "",
    };
  });

  const { data: jobRows } = await sb
    .from("agent_jobs")
    .select("id, kind, status, run_at, idempotency_key")
    .in("status", ["queued", "running"])
    .in("kind", ["draft_content", "render_image", "scan_mail"])
    .order("priority", { ascending: true })
    .limit(40);

  let workers: GtmPack["workers"] = [];
  const live = await sb.from("agent_liveness").select("*");
  if (!live.error) {
    workers = (live.data ?? []).map((w: {
      agent: string;
      last_seen?: string;
      stale?: boolean;
      note?: string;
    }) => ({
      agent: w.agent,
      last_seen: w.last_seen ?? null,
      stale: typeof w.stale === "boolean" ? w.stale : null,
      note: w.note ?? null,
    }));
  } else {
    const beats = await sb.from("agent_heartbeats").select("agent, last_seen, note");
    workers = (beats.data ?? []).map((w: { agent: string; last_seen?: string; note?: string }) => ({
      agent: w.agent,
      last_seen: w.last_seen ?? null,
      stale: null,
      note: w.note ?? null,
    }));
  }

  return {
    generated_at,
    icp: PROXE_ICP,
    keywords_use,
    market_md: market_md || "No market snapshot yet. Run listen, or wait for the GTM tick.",
    ideas,
    jobs: (jobRows ?? []) as GtmPack["jobs"],
    workers,
    last_tick: gtm?.payload && typeof gtm.payload === "object" ? (gtm.payload as Record<string, unknown>) : null,
    contract: CONTRACT,
  };
}

export function gtmPackMarkdown(pack: GtmPack): string {
  const lines: string[] = [];
  lines.push("# ARC GTM beacon");
  lines.push(`Generated ${pack.generated_at}`);
  lines.push("");
  lines.push("## Ownership");
  lines.push(pack.contract.ownership);
  lines.push("");
  lines.push("## ICP");
  lines.push(`${pack.icp.who}. ${pack.icp.leak}.`);
  lines.push(`Job: ${pack.icp.job}. Not ${pack.icp.not}.`);
  lines.push("");
  lines.push("## Use keywords");
  if (!pack.keywords_use.length) {
    lines.push("None marked use yet.");
  } else {
    for (const k of pack.keywords_use) {
      lines.push(`- ${k.phrase} (rank ${k.rank_score}, ${k.cluster}, ${k.vertical}, ${k.hits} hits)`);
    }
  }
  lines.push("");
  lines.push("## Market");
  lines.push(pack.market_md);
  lines.push("");
  lines.push("## Ideas");
  const proposed = pack.ideas.filter((i) => i.status === "proposed");
  const approved = pack.ideas.filter((i) => i.status === "approved");
  lines.push(`${proposed.length} proposed, ${approved.length} approved. Draft jobs fire only for approved.`);
  for (const i of pack.ideas.slice(0, 16)) {
    lines.push(`- [${i.status} ${i.fit_score}] ${i.title || i.angle}`);
  }
  if (!pack.ideas.length) lines.push("None. Tick fills proposed ideas when the feed has signals.");
  lines.push("");
  lines.push("## Jobs in flight");
  if (!pack.jobs.length) {
    lines.push("Queue empty. Workers claiming draft_content / render_image will idle until a tick enqueues them.");
  } else {
    for (const j of pack.jobs) {
      lines.push(`- ${j.kind} ${j.status} ${j.idempotency_key || j.id}`);
    }
  }
  lines.push("");
  lines.push("## Workers");
  if (!pack.workers.length) {
    lines.push("No heartbeats. Luko (or any bot) should POST /api/agent/heartbeat.");
  } else {
    for (const w of pack.workers) {
      const flag = w.stale ? " STALE" : "";
      lines.push(`- ${w.agent}${flag} last_seen ${w.last_seen || "never"}${w.note ? ` (${w.note})` : ""}`);
    }
  }
  lines.push("");
  lines.push("## Contract");
  lines.push(`- pull: ${pack.contract.pull}`);
  lines.push(`- next: ${pack.contract.next}`);
  lines.push(`- tick: ${pack.contract.tick}`);
  lines.push(`- conversation: ${pack.contract.conversation}`);
  return lines.join("\n");
}
