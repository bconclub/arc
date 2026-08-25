"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plug, Radio, KeyRound, RefreshCw, Plus, ShieldCheck,
} from "lucide-react";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { FilterBar, type SelectFilter } from "@/components/ui/FilterBar";
import { PROXE_ICP } from "@/lib/icp";
import type { KeywordRow, ConnectionProbe } from "@/types/market";

type ListenPayload = {
  rows: KeywordRow[];
  connections: ConnectionProbe[];
  scored?: number;
  harvested?: number;
  signals?: number;
  error?: string;
};

const CLUSTER_TONE: Record<string, Tone> = {
  pain: "bad",
  job: "good",
  category: "info",
  competitor: "warn",
  geo: "neutral",
};

function probeTone(c: ConnectionProbe): Tone {
  if (!c.configured) return "neutral";
  if (c.ok === true) return "good";
  if (c.ok === false) return "bad";
  return "warn";
}

function probeLabel(c: ConnectionProbe): string {
  if (!c.configured) return "not configured";
  if (c.ok === true) return "live";
  if (c.ok === false) return "failing";
  return "configured";
}

export default function ConnectionsPage() {
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [connections, setConnections] = useState<ConnectionProbe[]>([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [liveWeb, setLiveWeb] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [cluster, setCluster] = useState("");
  const [vertical, setVertical] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [docsScored, setDocsScored] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const data = await fetch("/api/market/listen").then((r) => r.json()).catch(() => null);
    if (!data) {
      setError("Could not load the keyword bank.");
      setLoading(false);
      return;
    }
    if (data.error && !(data.rows ?? []).length) setError(data.error);
    setRows(Array.isArray(data.rows) ? data.rows : []);
    setConnections(Array.isArray(data.connections) ? data.connections : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runListen() {
    setListening(true);
    setError("");
    setNote("");
    const data: ListenPayload = await fetch("/api/market/listen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liveWeb, testConnections: true }),
    }).then((r) => r.json()).catch(() => ({ rows: [], connections: [], error: "Listen failed." }));
    setListening(false);
    if (data.error) setError(data.error);
    setRows(Array.isArray(data.rows) ? data.rows : []);
    setConnections(Array.isArray(data.connections) ? data.connections : []);
    if (!data.error) {
      setDocsScored(data.signals ?? 0);
      setNote(`Scored ${data.scored ?? 0} phrases against ${data.signals ?? 0} market documents. Harvested ${data.harvested ?? 0} new watch phrases.`);
    }
  }

  async function addPhrase() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/icp/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phrase: draft }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error || "Could not add phrase."); return; }
    setDraft("");
    load();
  }

  async function setRowStatus(id: string, next: "use" | "watch" | "drop") {
    const res = await fetch("/api/icp/keywords", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "Save failed."); return; }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
  }

  const filters: SelectFilter[] = [
    {
      key: "cluster", label: "Cluster", value: cluster,
      options: ["pain", "job", "category", "competitor", "geo"].map((v) => ({ value: v, label: v })),
      onChange: setCluster,
    },
    {
      key: "vertical", label: "Vertical", value: vertical,
      options: ["clinic", "coaching", "real_estate", "tutoring", "founder", "all"].map((v) => ({ value: v, label: v.replace("_", " ") })),
      onChange: setVertical,
    },
    {
      key: "status", label: "Status", value: status,
      options: ["use", "watch", "drop"].map((v) => ({ value: v, label: v })),
      onChange: setStatus,
    },
  ];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (cluster && r.cluster !== cluster) return false;
      if (vertical && r.vertical !== vertical) return false;
      if (status && r.status !== status) return false;
      if (q && !`${r.phrase} ${r.evidence}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, cluster, vertical, status, search]);

  const inUse = rows.filter((r) => r.status === "use").length;
  const live = connections.filter((c) => c.ok === true).length;
  const failing = connections.filter((c) => c.ok === false).length;

  const stats: Stat[] = [
    { key: "phrases", label: "ICP phrases", value: String(rows.length), hint: `${inUse} marked use`, icon: KeyRound },
    { key: "live", label: "Connections live", value: connections.length ? String(live) : "—", hint: connections.length ? `${failing} failing this probe` : "Run listen to test", icon: Plug },
    { key: "listen", label: "Market docs scored", value: docsScored == null ? "—" : String(docsScored), hint: "RSS cache, plus Tavily if ticked", icon: Radio },
  ];

  const proxe = connections.find((c) => c.kind === "proxe");
  const listeners = connections.filter((c) => c.kind !== "proxe");

  return (
    <div className="space-y-6 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Plug size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Connections</h1>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-text-muted">
              PROXe is the product pipe. Listening connections watch the market.
              Keywords are ranked against what those connections actually return, not against invented search volume.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-text-muted">
            <input
              type="checkbox"
              checked={liveWeb}
              onChange={(e) => setLiveWeb(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            Live web (spends Tavily)
          </label>
          <button
            onClick={runListen}
            disabled={listening}
            className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-bg disabled:opacity-50"
          >
            <RefreshCw size={13} className={listening ? "animate-spin" : ""} />
            {listening ? "Listening…" : "Listen and rank"}
          </button>
        </div>
      </header>

      <StatStrip stats={stats} />

      <section className="rounded-panel border border-[var(--border)] bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-text-muted" />
          <h2 className="text-[13.5px] font-semibold text-text">Who this is for</h2>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">ICP</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-text">{PROXE_ICP.who}. {PROXE_ICP.leak}.</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Job / not</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-text">{PROXE_ICP.job}. Not {PROXE_ICP.not}.</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-panel border border-[var(--border)] bg-surface shadow-card">
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5">
          <div>
            <h2 className="text-[13.5px] font-semibold text-text">PROXe pipe</h2>
            <p className="mt-0.5 text-[11.5px] text-text-muted">
              WhatsApp send goes through PROXe. Dial results and briefs land in ARC. Cold WhatsApp still needs a Meta template.
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
          {proxe ? (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--glow-white)] px-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-text">PROXe</span>
                  <StatusPill status={probeLabel(proxe)} tone={probeTone(proxe)} />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{proxe.detail}</p>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-text-muted">
              Run listen to probe the origin. Until then this page will not pretend the pipe is live.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-panel border border-[var(--border)] bg-surface shadow-card">
        <div className="px-4 pb-2 pt-3.5">
          <h2 className="text-[13.5px] font-semibold text-text">Listening</h2>
          <p className="mt-0.5 text-[11.5px] text-text-muted">
            RSS sources already on the Sources page, plus Tavily when the key is present. Each row is a real fetch, not a stored status.
          </p>
        </div>
        {listeners.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px] text-text-muted">Nothing probed yet. Listen and rank tests a sample of active feeds.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12.5px]">
              <thead className="border-y border-[var(--border)] text-[10.5px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Connection</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-4 py-2 font-medium">What happened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {listeners.map((c) => (
                  <tr key={c.key}>
                    <td className="px-4 py-2 font-medium text-text">{c.name}</td>
                    <td className="px-3 py-2 capitalize text-text-muted">{c.kind}</td>
                    <td className="px-3 py-2"><StatusPill status={probeLabel(c)} tone={probeTone(c)} /></td>
                    <td className="px-4 py-2 text-text-muted">{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-panel border border-[var(--border)] bg-surface shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-3.5">
          <div>
            <h2 className="text-[13.5px] font-semibold text-text">Keyword bank</h2>
            <p className="mt-0.5 text-[11.5px] text-text-muted">
              Listen-rank is ICP fit, specificity and how often the listening set said it. It is not Google volume.
            </p>
          </div>
          <form
            className="flex min-h-[36px] items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); addPhrase(); }}
          >
            <label className="sr-only" htmlFor="new-phrase">New phrase</label>
            <input
              id="new-phrase"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="two or more words the buyer would type"
              className="h-9 w-64 rounded-lg border border-[var(--border)] bg-surface px-3 text-[12.5px] text-text placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={saving || !draft.trim()}
              className="flex min-h-[36px] cursor-pointer items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-[12px] font-medium text-text disabled:opacity-50"
            >
              <Plus size={13} /> Add
            </button>
          </form>
        </div>

        <div className="px-4 pb-3">
          <FilterBar
            filters={filters}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search phrases"
            onClear={() => { setCluster(""); setVertical(""); setStatus(""); setSearch(""); }}
          />
        </div>

        {error && <p className="px-4 pb-2 text-[12px] text-accent-red">{error}</p>}
        {note && !error && <p className="px-4 pb-2 text-[12px] text-text-muted">{note}</p>}

        {loading && rows.length === 0 ? (
          <p className="px-4 pb-6 text-[12.5px] text-text-muted">Loading keyword bank…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 pb-6 text-[12.5px] text-text-muted">
            {rows.length === 0 ? "No phrases yet. Run the migration, then listen." : "No phrases match these filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12.5px]">
              <thead className="border-y border-[var(--border)] text-[10.5px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Phrase</th>
                  <th className="px-3 py-2 font-medium">Cluster</th>
                  <th className="px-3 py-2 font-medium">Vertical</th>
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium">Hits</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-2 font-medium text-text">{r.phrase}</td>
                    <td className="px-3 py-2"><StatusPill status={r.cluster} tone={CLUSTER_TONE[r.cluster]} /></td>
                    <td className="px-3 py-2 capitalize text-text-muted">{r.vertical.replace("_", " ")}</td>
                    <td className="px-3 py-2 tabular-nums text-text">{r.rank_score}</td>
                    <td className="px-3 py-2 tabular-nums text-text-muted">{r.hits}</td>
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`st-${r.id}`}>Status for {r.phrase}</label>
                      <select
                        id={`st-${r.id}`}
                        value={r.status}
                        onChange={(e) => setRowStatus(r.id, e.target.value as "use" | "watch" | "drop")}
                        className="h-8 cursor-pointer rounded-pill border border-[var(--border)] bg-surface px-2 text-[12px] text-text"
                      >
                        <option value="use">use</option>
                        <option value="watch">watch</option>
                        <option value="drop">drop</option>
                      </select>
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2 text-text-muted" title={r.evidence}>
                      {r.evidence || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
