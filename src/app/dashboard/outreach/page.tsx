"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Plus, Search, Sparkles, ExternalLink } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnCls, btnPrimaryCls } from "@/components/ops/Modal";
import type { OutreachKind, OutreachStatus, OutreachTarget, OutreachMessage } from "@/types/ops";

const KIND_TABS: { key: OutreachKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "business", label: "Businesses" },
  { key: "investor", label: "Investors" },
  { key: "grant", label: "Grants" },
  { key: "citation", label: "Citations" },
];

const STATUS_META: Record<OutreachStatus, { label: string; dot: string }> = {
  identified: { label: "identified", dot: "bg-text-muted" },
  researched: { label: "researched", dot: "bg-accent-blue" },
  drafted: { label: "drafted", dot: "bg-accent-orange" },
  sent: { label: "sent", dot: "bg-accent-blue" },
  replied: { label: "replied", dot: "bg-accent-green" },
  meeting: { label: "meeting", dot: "bg-accent-green" },
  won: { label: "won", dot: "bg-accent-green" },
  lost: { label: "lost", dot: "bg-accent-red" },
  no_reply: { label: "no reply", dot: "bg-accent-red" },
};
const STATUSES = Object.keys(STATUS_META) as OutreachStatus[];

/** The working set: what today's 10 get picked from. */
const ACTIVE: OutreachStatus[] = ["identified", "researched", "drafted"];

type Candidate = { org: string; website: string | null; city: string | null; segment: string | null; why_them: string; source_url: string };

type FormState = Partial<OutreachTarget> & { name: string; kind: OutreachKind };
const EMPTY: FormState = { name: "", kind: "business", status: "identified" };

export default function OutreachPage() {
  const [targets, setTargets] = useState<OutreachTarget[]>([]);
  const [tab, setTab] = useState<OutreachKind | "all">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [reply, setReply] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState("");           // which action is running
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [segment, setSegment] = useState("");
  const [city, setCity] = useState("Bangalore");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | "active" | null>(null);
  const [preferToday, setPreferToday] = useState(false);
  const [waText, setWaText] = useState("");
  const [researchExpanded, setResearchExpanded] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/outreach").then((r) => r.json()).catch(() => []);
    setTargets(Array.isArray(data) ? data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let result = targets.filter((t) => {
      if (tab !== "all" && t.kind !== tab) return false;
      if (!needle) return true;
      return [t.name, t.org, t.segment, t.city, t.email, t.status]
        .some((f) => (f ?? "").toLowerCase().includes(needle));
    });

    if (statusFilter) {
      if (statusFilter === "active") {
        result = result.filter((t) => ACTIVE.includes(t.status));
      } else {
        result = result.filter((t) => t.status === statusFilter);
      }
    }

    return result;
  }, [targets, tab, q, statusFilter]);

  const today = useMemo(
    () => filtered.filter((t) => ACTIVE.includes(t.status)).slice(0, 10),
    [filtered],
  );
  const allProspects = useMemo(
    () => filtered.filter((t) => ACTIVE.includes(t.status)),
    [filtered],
  );
  const rest = useMemo(
    () => filtered.filter((t) => !ACTIVE.includes(t.status)),
    [filtered],
  );

  // Derive display mode: ALWAYS show expanded unless user explicitly collapsed
  const showAllProspects = !preferToday;

  const counts = useMemo(() => {
    const c: Partial<Record<OutreachStatus, number>> = {};
    for (const t of targets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [targets]);

  async function openTarget(t: OutreachTarget) {
    setError(""); setNotice(""); setReply(""); setInstructions("");
    setEditing({ ...t });
    const msgs = await fetch(`/api/outreach/${t.id}/messages`).then((r) => r.json()).catch(() => []);
    setMessages(Array.isArray(msgs) ? msgs : []);
  }

  async function save() {
    if (!editing?.name?.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch(editing.id ? `/api/outreach/${editing.id}` : "/api/outreach", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setEditing(null); load();
  }

  async function remove() {
    if (!editing?.id || !confirm(`Delete "${editing.name}"?`)) return;
    setSaving(true);
    await fetch(`/api/outreach/${editing.id}`, { method: "DELETE" });
    setSaving(false); setEditing(null); load();
  }

  /** Research / draft run against the SAVED row; unsaved edits ride along first. */
  async function runAction(action: "research" | "draft") {
    if (!editing?.id) { setError("Save the target first."); return; }
    setBusy(action); setError(""); setNotice("");
    // Push field edits (email especially) so the action sees them.
    await fetch(`/api/outreach/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    }).catch(() => null);

    const res = await fetch(`/api/outreach/${editing.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "draft" ? { instructions } : {}),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) { setError(json.error || `${action} failed`); return; }

    if (action === "research") {
      setEditing((e) => (e ? { ...e, research: json.research, status: json.status } : e));
      setNotice("Research saved.");
    } else {
      setNotice(json.gmail === "drafted"
        ? "Draft is in your Gmail Drafts folder."
        : `Draft saved here. Gmail: ${json.gmail}`);
      const msgs = await fetch(`/api/outreach/${editing.id}/messages`).then((r) => r.json()).catch(() => []);
      setMessages(Array.isArray(msgs) ? msgs : []);
    }
    load();
  }

  /** Send (or dry-run) WhatsApp through PROXe's intent endpoint. The dry run
   *  reports which mode PROXe would use (free text in-window vs template) and
   *  whether the lead exists there yet, without sending anything. */
  async function sendWhatsApp(dryRun: boolean) {
    if (!editing?.id || !waText.trim()) return;
    setBusy(dryRun ? "wa-dry" : "wa"); setError(""); setNotice("");
    await fetch(`/api/outreach/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    }).catch(() => null);
    const res = await fetch(`/api/outreach/${editing.id}/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: waText, dry_run: dryRun }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    const p = json.proxe ?? {};
    if (!res.ok) {
      setError(p.error ? `PROXe: ${p.error}${p.needed === "template" ? " (cold contact, needs an approved template)" : ""}` : json.error || "WhatsApp send failed");
      return;
    }
    if (dryRun) {
      setNotice(`Dry run: would send as ${p.would_send ?? "?"}; lead ${p.lead_found ? "exists" : "not in PROXe yet"}; window ${p.window_open ? "open" : "closed"}.`);
    } else {
      setNotice(p.sent ? `Sent as ${p.mode}. Lead ${p.lead_created ? "created in PROXe" : "updated"}; replies land in the PROXe inbox.` : "Send did not go out.");
      const msgs = await fetch(`/api/outreach/${editing.id}/messages`).then((r) => r.json()).catch(() => []);
      setMessages(Array.isArray(msgs) ? msgs : []);
      load();
    }
  }

  async function logReply() {
    if (!editing?.id || !reply.trim()) return;
    setBusy("reply");
    await fetch(`/api/outreach/${editing.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: "in", channel: "email", body: reply }),
    });
    setBusy(""); setReply("");
    const msgs = await fetch(`/api/outreach/${editing.id}/messages`).then((r) => r.json()).catch(() => []);
    setMessages(Array.isArray(msgs) ? msgs : []);
    setEditing((e) => (e ? { ...e, status: "replied" } : e));
    load();
  }

  async function suggest() {
    if (!segment.trim()) return;
    setBusy("suggest"); setCandidates(null); setError("");
    const res = await fetch("/api/outreach/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment, city }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) { setError(json.error || "Suggest failed"); return; }
    setCandidates(Array.isArray(json.candidates) ? json.candidates : []);
  }

  async function acceptCandidate(c: Candidate) {
    await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "business", name: c.org, org: c.org, website: c.website,
        city: c.city, segment: c.segment, why_them: c.why_them, source: "suggest",
      }),
    });
    setCandidates((cs) => (cs ?? []).filter((x) => x !== c));
    load();
  }

  function TargetsTable({ targets }: { targets: OutreachTarget[] }) {
    return (
      <div className="overflow-hidden rounded-card border border-[var(--border)]">
        <table className="w-full">
          <thead className="bg-surface-hover">
            <tr>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Name</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Segment</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">City</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Phone</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Website</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Status</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Kind</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {targets.map((t) => (
              <tr
                key={t.id}
                onClick={() => openTarget(t)}
                className="cursor-pointer bg-surface transition-colors hover:bg-surface-hover"
              >
                <td className="px-3 py-1.5 text-[12.5px] font-medium text-text">{t.name}</td>
                <td className="px-3 py-1.5 text-[12.5px] text-text-muted">{t.segment || "—"}</td>
                <td className="px-3 py-1.5 text-[12.5px] text-text-muted">{t.city || "—"}</td>
                <td className="px-3 py-1.5 text-[12.5px] text-text-muted whitespace-nowrap tabular-nums">{t.phone || "—"}</td>
                <td className="px-3 py-1.5 text-[12.5px] text-text-muted max-w-[180px]">
                  {t.website ? (
                    <a
                      href={t.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 hover:text-text"
                    >
                      <span className="truncate block max-w-[150px]">
                        {(() => {
                          try {
                            const url = new URL(t.website.startsWith('http') ? t.website : `https://${t.website}`);
                            return url.hostname.replace(/^www\./, '');
                          } catch {
                            return t.website;
                          }
                        })()}
                      </span>
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-surface px-2 py-0.5 text-[11px] text-text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[t.status].dot}`} />
                    {STATUS_META[t.status].label}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-[10.5px] uppercase tracking-wide text-text-muted">{t.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-1 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Send size={18} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Outreach</h1>
            <p className="text-[11.5px] text-text-muted">
              {targets.length} targets · {counts.sent ?? 0} sent · {counts.replied ?? 0} replied · {counts.won ?? 0} won
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search targets"
              className="w-44 rounded-full border border-[var(--border)] bg-surface py-1.5 pl-7 pr-3 text-[12px] text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]"
            />
          </label>
          <button className={btnCls} onClick={() => { setSuggestOpen(true); setCandidates(null); }}>
            <span className="flex items-center gap-1.5"><Sparkles size={13} /> Suggest</span>
          </button>
          <button className={btnPrimaryCls} onClick={() => { setError(""); setNotice(""); setMessages([]); setEditing({ ...EMPTY }); }}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> Target</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {KIND_TABS.map((k) => (
            <button
              key={k.key}
              onClick={() => setTab(k.key)}
              className={`rounded-full border px-3 py-1 text-[12px] transition-all ${
                tab === k.key
                  ? "border-[var(--border-strong)] bg-surface-hover font-semibold text-text"
                  : "border-[var(--border)] text-text-muted hover:text-text"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-text-muted">Status:</span>
          <button
            onClick={() => setStatusFilter(null)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-all ${
              statusFilter === null
                ? "border-[var(--border-strong)] bg-surface-hover font-semibold text-text"
                : "border-[var(--border)] text-text-muted hover:text-text"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-all ${
              statusFilter === "active"
                ? "border-[var(--border-strong)] bg-surface-hover font-semibold text-text"
                : "border-[var(--border)] text-text-muted hover:text-text"
            }`}
          >
            Active (prospecting)
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-all ${
                statusFilter === s
                  ? "border-[var(--border-strong)] bg-surface-hover font-semibold text-text"
                  : "border-[var(--border)] text-text-muted hover:text-text"
              }`}
            >
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
                {STATUS_META[s].label}
                {counts[s] ? ` (${counts[s]})` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Today: the working set, capped at 10 by design (10/day is the motion) */}
      {!showAllProspects && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Today — research, draft, send ({today.length}/10)
          </p>
          {today.length > 0 ? (
            <TargetsTable targets={today} />
          ) : (
            <p className="rounded-card border border-[var(--border)] bg-surface px-3.5 py-3 text-[12px] text-text-muted">
              No active targets{tab !== "all" ? " in this tab" : ""}. Add one or use Suggest.
            </p>
          )}
          {allProspects.length > 10 && (
            <button
              onClick={() => setPreferToday(false)}
              className="mt-3 w-full rounded-card border border-[var(--border)] bg-surface px-3.5 py-2 text-[12px] text-text-muted transition-all hover:border-[var(--border-strong)] hover:bg-surface-hover hover:text-text"
            >
              Show all {allProspects.length} prospects (identified, researched, drafted)
            </button>
          )}
        </div>
      )}

      {/* All prospects board - shows everything without the 10 cap */}
      {showAllProspects && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              All prospects — {allProspects.length} active
            </p>
            {showAllProspects && allProspects.length > 10 && (
              <button
                onClick={() => setPreferToday(true)}
                className="text-[11px] text-text-muted hover:text-text"
              >
                Back to Today&apos;s 10
              </button>
            )}
          </div>
          {allProspects.length > 0 ? (
            <TargetsTable targets={allProspects} />
          ) : (
            <p className="rounded-card border border-[var(--border)] bg-surface px-3.5 py-3 text-[12px] text-text-muted">
              No active targets{tab !== "all" ? " in this tab" : ""}. Add one or use Suggest.
            </p>
          )}
        </div>
      )}

      {!showAllProspects && rest.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Pipeline ({rest.length})
          </p>
          <TargetsTable targets={rest} />
        </div>
      )}

      {/* ── Target modal ── */}
      {editing && (
        <Modal title={editing.id ? editing.name : "New target"} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Name">
              <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Kind">
              <select className={inputCls} value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as OutreachKind })}>
                {KIND_TABS.slice(1).map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Org">
              <input className={inputCls} value={editing.org ?? ""} onChange={(e) => setEditing({ ...editing, org: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputCls} value={editing.status ?? "identified"} onChange={(e) => setEditing({ ...editing, status: e.target.value as OutreachStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </Field>
            <Field label="Segment">
              <input className={inputCls} placeholder="coaching, clinic, real estate…" value={editing.segment ?? ""} onChange={(e) => setEditing({ ...editing, segment: e.target.value })} />
            </Field>
            <Field label="City">
              <input className={inputCls} value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
            <Field label="Website">
              <input className={inputCls} value={editing.website ?? ""} onChange={(e) => setEditing({ ...editing, website: e.target.value })} />
            </Field>
          </div>

          <Field label="Why them">
            <textarea rows={1} className={inputCls} value={editing.why_them ?? ""} onChange={(e) => setEditing({ ...editing, why_them: e.target.value })} />
          </Field>

          {editing.id && (
            <>
              <div className="mb-2">
                <button
                  onClick={() => setResearchExpanded(!researchExpanded)}
                  className="mb-1 flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text"
                >
                  <span>Research brief</span>
                  <span>{researchExpanded ? '▼' : '▶'}</span>
                </button>
                {researchExpanded && (
                  <textarea rows={3} className={inputCls} placeholder="Run Research, or paste your own notes" value={editing.research ?? ""} onChange={(e) => setEditing({ ...editing, research: e.target.value })} />
                )}
              </div>

              <Field label="Draft instructions (optional)">
                <input className={inputCls} placeholder="angle, detail to use, length…" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
              </Field>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button className={btnCls} disabled={!!busy} onClick={() => runAction("research")}>
                  {busy === "research" ? "Researching…" : "Research"}
                </button>
                <button className={btnCls} disabled={!!busy} onClick={() => runAction("draft")}>
                  {busy === "draft" ? "Drafting…" : "Draft email"}
                </button>
                <a
                  href="https://mail.google.com/mail/u/0/#drafts"
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[12px] text-text-muted hover:text-text"
                >
                  Gmail drafts <ExternalLink size={11} />
                </a>
              </div>

              {editing.phone && (
                <Field label="WhatsApp via PROXe (dry run first)">
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="message; cold contacts need an approved template"
                      value={waText}
                      onChange={(e) => setWaText(e.target.value)}
                    />
                    <button className={btnCls} disabled={!waText.trim() || !!busy} onClick={() => sendWhatsApp(true)}>
                      {busy === "wa-dry" ? "…" : "Dry run"}
                    </button>
                    <button className={btnCls} disabled={!waText.trim() || !!busy} onClick={() => sendWhatsApp(false)}>
                      {busy === "wa" ? "Sending…" : "Send"}
                    </button>
                  </div>
                </Field>
              )}

              {messages.length > 0 && (
                <Field label={`Messages (${messages.length})`}>
                  <div className="max-h-32 space-y-1.5 overflow-y-auto">
                    {messages.map((m) => (
                      <div key={m.id} className="rounded-xl border border-[var(--border)] px-2.5 py-1.5">
                        <p className="text-[10.5px] text-text-muted">
                          {m.direction === "in" ? "← reply" : "→ draft"}{m.sent_at ? " · sent" : ""} · {new Date(m.created_at).toLocaleDateString()}
                          {m.subject ? ` · ${m.subject}` : ""}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-snug text-text line-clamp-2">{m.body}</p>
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Log a reply (paste from Gmail)">
                <div className="flex gap-2">
                  <textarea rows={1} className={inputCls} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <button className={btnCls} disabled={!reply.trim() || !!busy} onClick={logReply}>
                    {busy === "reply" ? "…" : "Log"}
                  </button>
                </div>
              </Field>
            </>
          )}

          {notice && <p className="text-[12px] text-accent-green">{notice}</p>}
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onCancel={() => setEditing(null)} onSave={save} saving={saving || !!busy} canDelete={!!editing.id} onDelete={remove} />
        </Modal>
      )}

      {/* ── Suggest modal ── */}
      {suggestOpen && (
        <Modal title="Suggest targets" onClose={() => setSuggestOpen(false)}>
          <p className="mb-4 text-[12px] leading-relaxed text-text-muted">
            Live search for ICP businesses. Candidates come from real results; emails you fill in yourself.
          </p>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Segment">
              <input className={inputCls} placeholder="coaching academies" value={segment} onChange={(e) => setSegment(e.target.value)} />
            </Field>
            <Field label="City">
              <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
          </div>
          <button className={btnPrimaryCls} disabled={!segment.trim() || busy === "suggest"} onClick={suggest}>
            {busy === "suggest" ? "Searching…" : "Find candidates"}
          </button>

          {candidates && (
            <div className="mt-4 space-y-2">
              {candidates.length === 0 && <p className="text-[12px] text-text-muted">Nothing usable came back. Try a different segment phrasing.</p>}
              {(candidates as Candidate[]).map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-text">{c.org}</p>
                    <p className="text-[11.5px] text-text-muted">{[c.segment, c.city].filter(Boolean).join(" · ")}</p>
                    <p className="mt-0.5 text-[11.5px] text-text-muted">{c.why_them}</p>
                    {c.website && <p className="truncate text-[11px] text-text-muted">{c.website}</p>}
                  </div>
                  <button className={btnCls} onClick={() => acceptCandidate(c)}>Add</button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="mt-3 text-[12px] text-accent-red">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
