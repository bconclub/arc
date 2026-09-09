"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CallCostBreakdown } from "@/components/outreach/CallCostBreakdown";
import { Plus, RefreshCw, Search } from "lucide-react";
import { btnCls, btnPrimaryCls, inputCls } from "@/components/ops/Modal";
import type { OutreachTarget } from "@/types/ops";
import {
  citationOutcome,
  isTestTarget,
  latestActivity,
  outcomeLabel,
  workState,
  type OutreachActivity,
} from "@/lib/outreach-workflow";
import { SuggestTargets } from "@/components/outreach/SuggestTargets";
import { LeadDetail } from "@/components/outreach/LeadDetail";
import { CallReview, type BdrCall } from "@/components/outreach/CallReview";
type View = "lists" | "calls" | "citations" | "tests";
const views: { key: View; label: string; description: string }[] = [
  {
    key: "lists",
    label: "Outreach lists",
    description:
      "Prospects grouped by where they came from. Choose a source to review a batch.",
  },
  {
    key: "calls",
    label: "Calls",
    description:
      "Every BDR attempt, with recipient, agent, recording and transcript. Ended does not mean qualified.",
  },
  {
    key: "citations",
    label: "Citations",
    description:
      "Track submissions separately from sales. Only a verified public listing counts as live.",
  },
  {
    key: "tests",
    label: "Test activity",
    description:
      "Test targets and calls to your test number, separate from prospect work.",
  },
];
export default function OutreachPage() {
  const [targets, setTargets] = useState<OutreachTarget[]>([]),
    [activity, setActivity] = useState<OutreachActivity[]>([]),
    [calls, setCalls] = useState<BdrCall[]>([]);
  const [suggest, setSuggest] = useState(false);
  const [listMode, setListMode] = useState("all");
  const [view, setView] = useState<View>("lists"),
    [q, setQ] = useState(""),
    [source, setSource] = useState("all"),
    [kind, setKind] = useState("all"),
    [state, setState] = useState("all"),
    [agent, setAgent] = useState("all"),
    [audience, setAudience] = useState("all");
  const [loading, setLoading] = useState(true),
    [callsLoading, setCallsLoading] = useState(false),
    [error, setError] = useState(""),
    [callError, setCallError] = useState(""),
    [ready, setReady] = useState(false),
    [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<OutreachTarget> | null>(null),
    [callId, setCallId] = useState<string | null>(null),
    [callsLoaded, setCallsLoaded] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/outreach/workspace", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTargets(d.targets);
      setActivity(d.activity);
      setReady(d.reportingReady);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load outreach.");
    } finally {
      setLoading(false);
    }
  }, []);
  const loadCalls = useCallback(async () => {
    setCallsLoading(true);
    setCallError("");
    try {
      const r = await fetch("/api/outreach/calls", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCalls(d.calls);
      setCallsLoaded(true);
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Could not load calls.");
    } finally {
      setCallsLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    if (new URLSearchParams(window.location.search).get("view") === "calls")
      setView("calls");
  }, [load]);
  useEffect(() => {
    if (
      (view === "calls" || view === "tests" || editing?.id) &&
      !callsLoaded &&
      !callsLoading &&
      !callError
    )
      loadCalls();
  }, [view, editing?.id, callsLoaded, callsLoading, callError, loadCalls]);
  useEffect(() => {
    setPage(0);
  }, [view, q, source, kind, state, agent, audience]);
  const byTarget = useMemo(() => {
    const map = new Map<string, OutreachActivity[]>();
    for (const a of activity)
      map.set(a.target_id, [...(map.get(a.target_id) || []), a]);
    return map;
  }, [activity]);
  function progress(t: OutreachTarget) {
    if (t.promoted_at) return "handed_off";
    if (t.qualified_at) return "qualified";
    const rows = byTarget.get(t.id) || [];
    return t.kind === "citation"
      ? citationOutcome(t, rows)
      : latestActivity(rows)?.outcome ||
          (["won", "lost"].includes(t.status)
            ? t.status
            : t.status === "sent"
              ? "sent"
              : t.status === "replied" || t.status === "meeting"
                ? "replied"
                : "pending");
  }
  const base = targets.filter((t) =>
    view === "tests"
      ? isTestTarget(t)
      : !isTestTarget(t) &&
        (view === "citations" ? t.kind === "citation" : t.kind !== "citation"),
  );
  const sources = Array.from(
    new Set(base.map((t) => t.source || "Unspecified")),
  ).sort();
  const filteredBase = base.filter(
    (t) =>
      (source === "all" || (t.source || "Unspecified") === source) &&
      (kind === "all" || t.kind === kind) &&
      [t.name, t.phone, t.email, t.city, t.segment, t.source].some((v) =>
        v?.toLowerCase().includes(q.toLowerCase()),
      ),
  );
  const scopedTargets = view !== 'lists' || listMode === 'all' ? filteredBase
    : listMode === 'today' ? filteredBase.filter(t => ['identified','researched','drafted'].includes(t.status)).slice(0,10)
    : filteredBase.filter(t => t.kind === 'business' && !isTestTarget(t) &&
      (['sent','no_reply','replied','meeting','won','lost'].includes(t.status) || (byTarget.get(t.id) || []).some(a => a.channel === 'call')))
      .sort((a,b) => Date.parse(latestActivity(byTarget.get(b.id)||[])?.occurred_at || b.updated_at) - Date.parse(latestActivity(byTarget.get(a.id)||[])?.occurred_at || a.updated_at));
  const filtered = scopedTargets.filter((t) => state === "all" || workState(progress(t)) === state);
  const scopedCalls = calls.filter(
    (c) =>
      (view !== "tests" || c.is_test === true) &&
      (agent === "all" || c.agent === agent) &&
      (audience === "all" ||
        (audience === "test"
          ? c.is_test === true
          : audience === "other"
            ? c.is_test === false
            : c.is_test === null)) &&
      [c.phone, c.agent, c.summary, c.status].some((v) =>
        v?.toLowerCase().includes(q.toLowerCase()),
      ),
  );
  function callState(c: BdrCall) {
    return c.status === "failed" ? "blocked" : c.status === "done" ? "done" : "in_progress";
  }
  const filteredCalls = scopedCalls.filter((c) => state === "all" || callState(c) === state);
  const current = views.find((v) => v.key === view)!;
  function changeView(v: View) {
    setView(v);
    setSource("all");
    setState("all");
    setKind("all");
    setQ("");
    setAudience("all");
    setAgent("all");
  }
  function openCall(id: string) {
    setCallId(id);
  }
  function nameForCall(c: BdrCall) {
    const p = c.phone?.replace(/\D/g, "").slice(-10);
    if (!p || p.length !== 10) return "Recipient unavailable";
    const matches = targets.filter(
      (t) => t.phone?.replace(/\D/g, "").slice(-10) === p,
    );
    return matches.length === 1
      ? matches[0].name
      : matches.length > 1
        ? "Multiple matching targets"
        : c.phone;
  }
  const showCalls = view === "calls" || view === "tests";
  const rows = showCalls ? filteredCalls : filtered;
  const progressOptions = [
    { key: "all", label: "All" },
    ...(!showCalls ? [{ key: "pending", label: "Pending" }] : []),
    { key: "in_progress", label: "In progress" },
    { key: "done", label: showCalls ? "Ended" : "Done" },
    { key: "blocked", label: showCalls ? "Failed" : "Needs attention" },
  ];
  return (
    <div className="page min-w-0 max-w-full space-y-5 text-text">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Outreach</h1>
          <p className="mt-1 text-sm text-text-muted">
            Lists, work in progress, and results in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={btnCls}
            disabled={loading || callsLoading}
            onClick={() => {
              load();
              if (callsLoaded || view === "calls" || view === "tests")
                loadCalls();
            }}
          >
            <span className="flex items-center gap-2">
              <RefreshCw size={15} />
              Refresh
            </span>
          </button>
          <button className={btnCls} onClick={() => setSuggest(true)}>
            Find prospects
          </button>
          <button
            className={btnPrimaryCls}
            onClick={() =>
              setEditing({
                name: "",
                kind: view === "citations" ? "citation" : "business",
                status: "identified",
              })
            }
          >
            <span className="flex items-center gap-2">
              <Plus size={16} />
              Add target
            </span>
          </button>
        </div>
      </header>
      {view === 'lists' && <label className="block text-sm">Prospect view <select className={inputCls + ' ml-2 max-w-56'} value={listMode} onChange={e => {setListMode(e.target.value);setPage(0);}}><option value="all">All Prospects</option><option value="today">Today&apos;s 10</option><option value="outreached">Dialed / Outreached</option></select></label>}
      <nav
        aria-label="Outreach areas"
        className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
      >
        {views.map((v) => (
          <button
            className={
              "min-h-11 rounded-lg px-4 py-2 text-sm " +
              (view === v.key
                ? "bg-surface-hover font-semibold"
                : "text-text-muted hover:text-text")
            }
            key={v.key}
            aria-pressed={view === v.key}
            onClick={() => changeView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <p className="text-sm text-text-muted">{current.description}</p>
      {error && (
        <p role="alert" className="text-sm text-accent-red">
          {error}{" "}
          <button className={btnCls} onClick={load}>
            Retry
          </button>
        </p>
      )}
      {!loading && !ready && !error && (
        <p className="rounded-lg border border-[var(--border)] p-3 text-sm text-text-muted">
          Existing history is available. New worker reporting needs the database
          update. Historical “sent” citations are unverified.
        </p>
      )}
      {(view === "calls" || view === "tests") && callError && (
        <p role="alert" className="text-sm text-accent-red">
          {callError}{" "}
          <button className={btnCls} onClick={loadCalls}>
            Retry calls
          </button>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 basis-full space-y-1 text-sm md:basis-64 md:flex-1">
          <span className="text-text-muted">Search</span>
          <span className="relative block">
            <Search
              size={16}
              className="absolute left-3 top-3 text-text-muted"
            />
            <input
              aria-label="Search outreach"
              className={inputCls + " pl-9"}
              placeholder={
                showCalls
                  ? "Phone, agent or summary"
                  : "Name, phone, city or source"
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </span>
        </label>
        {!showCalls && (
          <>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Source / batch</span>
              <select
                className={inputCls + " max-w-64"}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="all">All sources ({sources.length})</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s} (
                    {
                      base.filter((t) => (t.source || "Unspecified") === s)
                        .length
                    }
                    )
                  </option>
                ))}
              </select>
            </label>
            {view === "lists" && (
              <label className="space-y-1 text-sm">
                <span className="text-text-muted">Type</span>
                <select
                  className={inputCls}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="business">Businesses</option>
                  <option value="investor">Investors</option>
                  <option value="grant">Grants</option>
                </select>
              </label>
            )}
          </>
        )}
        {showCalls && (
          <>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Agent</span>
              <select
                className={inputCls}
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              >
                <option value="all">All agents</option>
                {["Intro DM", "Intro Cold", "Follow-up"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            {view !== "tests" && (
              <label className="space-y-1 text-sm">
                <span className="text-text-muted">Recipient</span>
                <select
                  className={inputCls}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  <option value="all">All numbers</option>
                  <option value="other">Other numbers</option>
                  <option value="test">Test number</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            )}
          </>
        )}
      </div>
      <div aria-label="Filter by progress" className="flex flex-wrap gap-2">
        {progressOptions.map((option) => {
          const count = showCalls
            ? scopedCalls.filter((c) => option.key === "all" || callState(c) === option.key).length
            : scopedTargets.filter((t) => option.key === "all" || workState(progress(t)) === option.key).length;
          return (
            <button key={option.key} aria-pressed={state === option.key}
              onClick={() => setState(option.key)}
              className={"min-h-11 rounded-lg border px-4 py-2 text-sm " + (state === option.key ? "border-text bg-surface-hover font-semibold" : "border-[var(--border)] text-text-muted hover:text-text")}>
              {option.label} <span className="ml-2 tabular-nums">{loading || (showCalls && callsLoading) ? "…" : count}</span>
            </button>
          );
        })}
      </div>
      {(loading && !targets.length) ||
      (callsLoading &&
        !callsLoaded &&
        (view === "calls" || view === "tests")) ? (
        <p role="status" className="py-8 text-sm text-text-muted">
          {callsLoading
            ? "Loading call history and recording availability…"
            : "Loading outreach lists…"}
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            {rows.length} {showCalls ? "call attempts" : "targets"}
            {showCalls
              ? " · " +
                filteredCalls.filter((c) => c.has_audio).length +
                " recordings available"
              : ""}
          </p>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-[var(--border)] p-6 text-sm">
              No matching {showCalls ? "calls" : "targets"}. Try another filter
              or add a target.
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-hover text-text-muted">
                  <tr>
                    {(showCalls
                      ? ["Recipient", "Agent", "When (IST)", "Result", "Cost & tokens", "Review"]
                      : [
                          "Name",
                          "List / source",
                          "Progress",
                          "Next step",
                          "Last update",
                        ]
                    ).map((h) => (
                      <th className="px-4 py-3 font-medium" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {showCalls
                    ? filteredCalls
                        .slice(page * 50, (page + 1) * 50)
                        .map((c) => (
                          <tr
                            className="bg-surface hover:bg-surface-hover"
                            key={c.id}
                          >
                            <td className="max-w-64 px-4 py-3">
                              <button
                                className="text-left font-medium underline-offset-4 hover:underline"
                                onClick={() => openCall(c.id)}
                              >
                                {nameForCall(c)}
                              </button>
                              <span className="mt-1 block whitespace-nowrap text-xs text-text-muted">
                                {c.phone || "Details unavailable"} ·{" "}
                                {c.is_test === true
                                  ? "Test"
                                  : c.is_test === false
                                    ? "Other number"
                                    : "Unknown"}
                              </span>
                            </td>
                            <td className="px-4 py-3">{c.agent}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                              {new Date(c.started_at).toLocaleString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="px-4 py-3">
                              {c.status === "done" ? "Ended" : c.status} ·{" "}
                              {c.duration}s
                            </td>
                            <td className="px-4 py-3"><CallCostBreakdown costs={c.costs} compact /></td>
                            <td className="px-4 py-3">
                              <button
                                className={btnCls}
                                onClick={() => openCall(c.id)}
                              >
                                {c.has_audio
                                  ? "Play & transcript"
                                  : "View attempt"}
                              </button>
                            </td>
                          </tr>
                        ))
                    : filtered.slice(page * 50, (page + 1) * 50).map((t) => {
                        const latest = latestActivity(byTarget.get(t.id) || []);
                        return (
                          <tr
                            className="bg-surface hover:bg-surface-hover"
                            key={t.id}
                          >
                            <td className="max-w-64 px-4 py-3">
                              <button
                                className="text-left font-medium underline-offset-4 hover:underline"
                                onClick={() => setEditing(t)}
                              >
                                {t.name}
                              </button>
                              <span className="mt-1 block text-xs text-text-muted">
                                {[t.phone, t.city]
                                  .filter(Boolean)
                                  .join(" · ") || "No contact details"}
                              </span>
                            </td>
                            <td className="max-w-48 break-words px-4 py-3 text-text-muted">
                              {t.kind}
                              <span className="mt-1 block text-xs">
                                {t.source || "Unspecified"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {outcomeLabel(progress(t))}
                            </td>
                            <td className="max-w-64 px-4 py-3 text-text-muted">
                              {t.notes ||
                                (progress(t) === "qualified"
                                  ? "Hand off to PROXe"
                                  : progress(t) === "handed_off"
                                    ? "Continue in PROXe"
                                    : progress(t) === "unverified"
                                      ? "Verify submission and add evidence"
                                      : workState(progress(t)) === "pending"
                                        ? "Review and choose next action"
                                        : "Review latest activity")}
                              {(latest?.next_at || t.next_at) && (
                                <span className="mt-1 block text-xs">
                                  Due{" "}
                                  {new Date(
                                    latest?.next_at || t.next_at || "",
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-text-muted">
                              {latest
                                ? latest.worker +
                                  " · " +
                                  new Date(
                                    latest.occurred_at,
                                  ).toLocaleDateString()
                                : "No activity yet"}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 50 && (
            <div className="flex items-center justify-end gap-3 text-sm">
              <button
                className={btnCls}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {Math.ceil(rows.length / 50)}
              </span>
              <button
                className={btnCls}
                disabled={(page + 1) * 50 >= rows.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
          {view === "tests" && base.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {base.map((t) => (
                <button
                  className={btnCls}
                  key={t.id}
                  onClick={() => setEditing(t)}
                >
                  Open {t.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {editing && !callId && (
        <LeadDetail
          key={editing.id || "new"}
          target={
            editing.id
              ? targets.find((t) => t.id === editing.id) || editing
              : editing
          }
          activity={byTarget.get(editing.id || "") || []}
          calls={calls}
          ready={ready}
          onClose={() => setEditing(null)}
          onSaved={load}
          onCall={openCall}
        />
      )}
      {suggest && (
        <SuggestTargets onClose={() => setSuggest(false)} onSaved={load} />
      )}
      {callId && <CallReview id={callId} returnToLead={!!editing} onClose={() => setCallId(null)} />}
    </div>
  );
}
