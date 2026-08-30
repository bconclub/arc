// Market listening loop. SERVER ONLY.
//
// Connections are tested, not decorated. A listen run reads what the market is
// saying (RSS cache, optional live Tavily), scores the ICP keyword bank against
// it, harvests new phrases, and parks a snapshot in agent_context so a bot can
// quote the same numbers the Connections page shows.

import { supabaseAdmin } from "@/lib/supabase";
import { fetchFeeds } from "@/lib/arc/rss";
import { tavilySearch } from "@/lib/outreach";
import { writeContext, ttl } from "@/lib/arc/agent-context";
import {
  SEED_KEYWORDS,
  harvestPhrases,
  listenRank,
  phraseMatches,
  type IcpKeyword,
  type KeywordCluster,
  type KeywordIntent,
  type KeywordSource,
  type KeywordStatus,
  type KeywordVertical,
} from "@/lib/icp";
import type { ConnectionProbe, KeywordRow } from "@/types/market";

export type { ConnectionProbe, KeywordRow } from "@/types/market";

type SignalBit = { title: string; snippet: string; source_name: string; url: string; published_date: string };

function missingTable(err: { message?: string } | null): boolean {
  return !!err?.message && /icp_keywords|schema cache|does not exist/i.test(err.message);
}

export async function ensureKeywordSeed(): Promise<{ ok: true } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabaseAdmin as any)
    .from("icp_keywords")
    .select("id", { count: "exact", head: true });
  if (error) {
    return { ok: false, error: missingTable(error)
      ? "Run the 20260825000000_icp_keywords migration first."
      : error.message };
  }
  if ((count ?? 0) > 0) return { ok: true };

  const rows = SEED_KEYWORDS.map((k) => ({
    ...k,
    rank_score: listenRank({ phrase: k.phrase, source: k.source, status: k.status, hits: 0 }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: ins } = await (supabaseAdmin as any).from("icp_keywords").insert(rows);
  if (ins) return { ok: false, error: ins.message };
  return { ok: true };
}

export async function listKeywords(): Promise<{ rows: KeywordRow[] } | { error: string }> {
  const seeded = await ensureKeywordSeed();
  if (!seeded.ok) return { error: seeded.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("icp_keywords")
    .select("id, phrase, cluster, vertical, intent, source, status, rank_score, hits, evidence, last_seen_at")
    .order("rank_score", { ascending: false });
  if (error) return { error: error.message };
  return { rows: (data ?? []) as KeywordRow[] };
}

async function loadSignals(): Promise<SignalBit[]> {
  const { data } = await supabaseAdmin
    .from("signals")
    .select("title, snippet, source_name, url, published_date")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as SignalBit[];
}

async function probeProxe(): Promise<ConnectionProbe> {
  const base = (process.env.PROXE_INTENT_BASE ?? "").replace(/\/$/, "");
  const key = process.env.PROXE_INBOUND_API_KEY;
  const ingest = process.env.ARC_INGEST_SECRET;
  const pipes = [
    key && base ? "WhatsApp send through PROXe" : null,
    ingest ? "dial results land in ARC" : null,
    ingest ? "briefs ingest is armed" : null,
  ].filter(Boolean);

  if (!base || !key) {
    return {
      key: "proxe",
      name: "PROXe",
      kind: "proxe",
      configured: false,
      ok: null,
      detail: `Not configured (${[!base && "PROXE_INTENT_BASE", !key && "PROXE_INBOUND_API_KEY"].filter(Boolean).join(", ")} missing). ${pipes.length ? `Armed: ${pipes.join("; ")}.` : "No pipe is live."}`,
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(base, { method: "GET", signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    const ok = res.status < 500;
    return {
      key: "proxe",
      name: "PROXe",
      kind: "proxe",
      configured: true,
      ok,
      detail: ok
        ? `Host responded HTTP ${res.status}. ${pipes.join("; ")}.`
        : `Host HTTP ${res.status}. Send path is configured but the origin is unhealthy.`,
    };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "No response in 6s" : (e instanceof Error ? e.message : "unreachable");
    return {
      key: "proxe",
      name: "PROXe",
      kind: "proxe",
      configured: true,
      ok: false,
      detail: msg,
    };
  }
}

async function probeRss(): Promise<ConnectionProbe[]> {
  const { data } = await supabaseAdmin
    .from("sources")
    .select("id, name, value, active")
    .eq("type", "rss")
    .eq("active", true)
    .order("name");
  const sources = (data ?? []) as { id: string; name: string; value: string; active: boolean }[];
  if (!sources.length) {
    return [{
      key: "rss-none",
      name: "RSS listening",
      kind: "rss",
      configured: false,
      ok: null,
      detail: "No active RSS sources. Add them on Sources.",
    }];
  }

  // Test a sample so a listen stays inside the route budget. Full sync is /api/arc/sync.
  const sample = sources.slice(0, 6);
  const results = await Promise.all(sample.map(async (s) => {
    try {
      const items = await fetchFeeds([s.value], { ogFallback: false });
      const latest = items[0]?.title;
      return {
        key: `rss:${s.id}`,
        name: s.name,
        kind: "rss" as const,
        configured: true,
        ok: items.length > 0,
        hits: items.length,
        detail: items.length
          ? `${items.length} stories. Latest: ${latest ?? "untitled"}`
          : "Feed reachable but empty.",
      };
    } catch (e) {
      return {
        key: `rss:${s.id}`,
        name: s.name,
        kind: "rss" as const,
        configured: true,
        ok: false,
        hits: 0,
        detail: e instanceof Error ? e.message : "fetch failed",
      };
    }
  }));

  if (sources.length > sample.length) {
    results.push({
      key: "rss:more",
      name: `${sources.length - sample.length} more RSS sources`,
      kind: "rss",
      configured: true,
      ok: true,
      hits: 0,
      detail: `Not probed this run. ${sources.length} active in total. Full refresh is Sources → sync.`,
    });
  }
  return results;
}

async function probeTavily(liveWeb: boolean): Promise<{ probe: ConnectionProbe; docs: SignalBit[] }> {
  const configured = !!process.env.TAVILY_API_KEY;
  if (!configured) {
    return {
      probe: {
        key: "tavily",
        name: "Live web (Tavily)",
        kind: "tavily",
        configured: false,
        ok: null,
        detail: "Not configured (TAVILY_API_KEY missing). Listen still ranks against the RSS set.",
      },
      docs: [],
    };
  }
  if (!liveWeb) {
    return {
      probe: {
        key: "tavily",
        name: "Live web (Tavily)",
        kind: "tavily",
        configured: true,
        ok: null,
        detail: "Configured. Tick live web on a listen to spend search credits against ICP queries.",
      },
      docs: [],
    };
  }

  const queries = [
    "missed WhatsApp leads small business India",
    "WhatsApp CRM for clinics India",
    "coaching institute admission enquiry WhatsApp",
    "real estate lead follow up automation India",
  ];
  const docs: SignalBit[] = [];
  let ok = 0;
  for (const q of queries) {
    const hits = await tavilySearch(q, 3);
    if (hits.length) ok++;
    for (const h of hits) {
      docs.push({
        title: h.title,
        snippet: h.content,
        source_name: "tavily",
        url: h.url,
        published_date: new Date().toISOString(),
      });
    }
  }
  return {
    probe: {
      key: "tavily",
      name: "Live web (Tavily)",
      kind: "tavily",
      configured: true,
      ok: ok > 0,
      hits: docs.length,
      detail: ok > 0
        ? `${docs.length} results across ${ok}/${queries.length} ICP queries.`
        : "Queries returned nothing. Key may be out of credits.",
    },
    docs,
  };
}

function corpusOf(signals: SignalBit[]): string[] {
  return signals.map((s) => `${s.title} ${s.snippet}`);
}

export async function listen(opts: { liveWeb?: boolean; testConnections?: boolean } = {}): Promise<{
  connections: ConnectionProbe[];
  scored: number;
  harvested: number;
  signals: number;
  error?: string;
}> {
  const seeded = await ensureKeywordSeed();
  if (!seeded.ok) return { connections: [], scored: 0, harvested: 0, signals: 0, error: seeded.error };

  const connections: ConnectionProbe[] = [];

  if (opts.testConnections !== false) {
    connections.push(await probeProxe());
    connections.push(...await probeRss());
  } else {
    const configured = !!(process.env.PROXE_INTENT_BASE && process.env.PROXE_INBOUND_API_KEY);
    connections.push({
      key: "proxe",
      name: "PROXe",
      kind: "proxe",
      configured,
      ok: null,
      detail: configured
        ? "Configured. Not probed this run (re-rank only)."
        : "Not configured (PROXE_INTENT_BASE / PROXE_INBOUND_API_KEY missing).",
    });
  }

  const tavily = await probeTavily(!!opts.liveWeb);
  connections.push(tavily.probe);

  const signals = [...await loadSignals(), ...tavily.docs];
  const texts = corpusOf(signals);

  const listed = await listKeywords();
  if ("error" in listed) return { connections, scored: 0, harvested: 0, signals: signals.length, error: listed.error };

  const existing = new Set(listed.rows.map((r) => r.phrase.toLowerCase()));
  const now = new Date().toISOString();
  await Promise.all(listed.rows.map((row) => {
    let hits = 0;
    let evidence = row.evidence;
    for (const s of signals) {
      const blob = `${s.title} ${s.snippet}`;
      if (phraseMatches(blob, row.phrase)) {
        hits++;
        if (hits === 1) evidence = `${s.source_name}: ${s.title}`.slice(0, 240);
      }
    }
    const rank = listenRank({ phrase: row.phrase, source: row.source, status: row.status, hits });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabaseAdmin as any).from("icp_keywords").update({
      hits,
      rank_score: rank,
      evidence: hits ? evidence : row.evidence,
      last_seen_at: hits ? now : row.last_seen_at,
    }).eq("id", row.id);
  }));

  const harvested = harvestPhrases(texts, existing);
  if (harvested.length) {
    const insert = harvested.map((k) => ({
      ...k,
      hits: 0,
      rank_score: listenRank({ phrase: k.phrase, source: k.source, status: k.status, hits: 0 }),
      evidence: "Harvested from the listening set this run.",
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("icp_keywords").upsert(insert, { onConflict: "phrase", ignoreDuplicates: true });
  }

  const after = await listKeywords();
  const top = ("rows" in after ? after.rows : []).slice(0, 12);
  const summary = [
    `ICP: ${"solo founders, clinics, coaching academies, real estate, tutoring centres in India"}.`,
    `Listen scored ${listed.rows.length} phrases against ${signals.length} market documents.`,
    harvested.length ? `Harvested ${harvested.length} new watch phrases.` : "No new phrases harvested.",
    "",
    "Top by listen-rank (not Google volume):",
    ...top.map((k) => `- ${k.phrase} [${k.vertical}/${k.cluster}] rank ${k.rank_score}, ${k.hits} hits`),
  ].join("\n");

  await writeContext({
    namespace: "icp_keywords",
    scope: "global",
    payload: {
      top: top.map((k) => ({ phrase: k.phrase, rank: k.rank_score, hits: k.hits, vertical: k.vertical, cluster: k.cluster })),
      harvested: harvested.length,
      signals: signals.length,
    },
    summary_md: summary,
    source: "market-listen",
    expires_at: ttl(360),
  });

  await writeContext({
    namespace: "market",
    scope: "global",
    payload: {
      connections,
      listened_at: now,
    },
    summary_md: connections.map((c) => `- ${c.name}: ${c.ok === null ? "not probed" : c.ok ? "ok" : "failing"} — ${c.detail}`).join("\n"),
    source: "market-listen",
    expires_at: ttl(360),
  });

  return {
    connections,
    scored: listed.rows.length,
    harvested: harvested.length,
    signals: signals.length,
  };
}

export type KeywordPatch = {
  status?: KeywordStatus;
  cluster?: KeywordCluster;
  vertical?: KeywordVertical;
  intent?: KeywordIntent;
};

export async function patchKeyword(id: string, patch: KeywordPatch): Promise<{ row?: KeywordRow; error?: string }> {
  const body: Record<string, unknown> = {};
  if (patch.status) body.status = patch.status;
  if (patch.cluster) body.cluster = patch.cluster;
  if (patch.vertical) body.vertical = patch.vertical;
  if (patch.intent) body.intent = patch.intent;
  if (!Object.keys(body).length) return { error: "nothing to update" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("icp_keywords")
    .update(body)
    .eq("id", id)
    .select("id, phrase, cluster, vertical, intent, source, status, rank_score, hits, evidence, last_seen_at")
    .single();
  if (error) return { error: error.message };
  return { row: data as KeywordRow };
}

export async function addKeyword(phrase: string, extras: Partial<IcpKeyword> = {}): Promise<{ row?: KeywordRow; error?: string }> {
  const clean = phrase.trim().replace(/\s+/g, " ").toLowerCase();
  if (wordCountSafe(clean) < 2) return { error: "Phrase needs at least two words. One-word terms are not ICP language." };
  const row = {
    phrase: clean,
    cluster: extras.cluster ?? "job",
    vertical: extras.vertical ?? "all",
    intent: extras.intent ?? "commercial",
    source: "manual" as KeywordSource,
    status: extras.status ?? "watch",
    hits: 0,
    rank_score: listenRank({ phrase: clean, source: "manual", status: extras.status ?? "watch", hits: 0 }),
    evidence: "Added by hand.",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("icp_keywords")
    .insert(row)
    .select("id, phrase, cluster, vertical, intent, source, status, rank_score, hits, evidence, last_seen_at")
    .single();
  if (error) return { error: error.message };
  return { row: data as KeywordRow };
}

function wordCountSafe(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}
