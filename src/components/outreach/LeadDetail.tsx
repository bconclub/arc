"use client";
import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { btnCls, btnPrimaryCls, inputCls } from "@/components/ops/Modal";
import type { OutreachTarget } from "@/types/ops";
import {
  OUTCOMES,
  isTestTarget,
  citationOutcome,
  outcomeLabel,
  safeUrl,
  type OutreachActivity,
  type ActivityChannel,
} from "@/lib/outreach-workflow";
import { OutreachDialog } from "./OutreachDialog";
import type { BdrCall } from "./CallReview";
const stages = [
  "identified",
  "researched",
  "drafted",
  "sent",
  "replied",
  "meeting",
  "won",
  "lost",
  "no_reply",
] as const;
function Label({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-text-muted">{name}</span>
      {children}
    </label>
  );
}
export function LeadDetail({
  target,
  activity,
  calls,
  ready,
  onClose,
  onSaved,
  onCall,
}: {
  target: Partial<OutreachTarget>;
  activity: OutreachActivity[];
  calls: BdrCall[];
  ready: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCall: (id: string) => void;
}) {
  const [tab, setTab] = useState(target.id ? "overview" : "edit"),
    [form, setForm] = useState(target);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [channel, setChannel] = useState<ActivityChannel>(
    target.kind === "citation" ? "citation" : "call",
  );
  const [outcome, setOutcome] = useState<string>(
    target.kind === "citation" ? "pending" : "queued",
  );
  const [summary, setSummary] = useState(""),
    [evidence, setEvidence] = useState(""),
    [next, setNext] = useState("");
  const [qualification, setQualification] = useState(
    target.qualification_note || "",
  );
  const [instructions, setInstructions] = useState(""),
    [wa, setWa] = useState(""),
    [reply, setReply] = useState("");
  const [eventId, setEventId] = useState<string | null>(null),
    [eventTime, setEventTime] = useState<string | null>(null);
  const phone = (target.phone || "").replace(/\D/g, "").slice(-10);
  const targetCalls = calls.filter(
    (c) =>
      phone.length === 10 && c.phone?.replace(/\D/g, "").slice(-10) === phone,
  );
  async function request(path: string, body: unknown, method = "POST") {
    const r = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok)
      throw new Error(d.error || d.proxe?.error || "Update failed. Try again.");
    return d;
  }
  async function action(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Retry.");
    } finally {
      setBusy("");
    }
  }
  async function save() {
    await action("save", async () => {
      if (!form.name?.trim()) throw new Error("Enter a name.");
      const patch = Object.fromEntries(
        Object.entries(form).filter(
          ([k, v]) => v !== target[k as keyof OutreachTarget],
        ),
      );
      await request(
        target.id ? "/api/outreach/" + target.id : "/api/outreach",
        target.id ? patch : form,
        target.id ? "PATCH" : "POST",
      );
      onSaved();
      onClose();
    });
  }
  async function log() {
    await action("log", async () => {
      const id = eventId || crypto.randomUUID(),
        at = eventTime || new Date().toISOString();
      setEventId(id);
      setEventTime(at);
      await request("/api/outreach/activity", {
        target_id: target.id,
        channel,
        outcome,
        summary,
        evidence_url: evidence || null,
        next_at: next ? new Date(next).toISOString() : null,
        external_id: id,
        occurred_at: at,
      });
      setSummary("");
      setEvidence("");
      setNext("");
      setEventId(null);
      setEventTime(null);
      setNotice("Update saved.");
      onSaved();
      setTab("activity");
    });
  }
  const latest = activity[0];
  const testTarget = isTestTarget({
    name: target.name || "",
    source: target.source || null,
    segment: target.segment || null,
    phone: target.phone,
  });
  const technicalNotes =
    /conversation[_ ]id|api\.|SIP=|TRANSCRIPT|call_successful/i.test(
      target.notes || "",
    );
  return (
    <OutreachDialog title={target.name || "New target"} onClose={onClose}>
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">
            {target.name || "New target"}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {[target.kind, target.city].filter(Boolean).join(" · ") ||
              "Add to your outreach list"}
          </p>
        </div>
        <button
          className={btnCls}
          aria-label="Close lead"
          onClick={onClose}
          disabled={!!busy}
        >
          <X size={18} />
        </button>
      </header>
      {target.id && (
        <nav
          aria-label="Lead sections"
          className="flex gap-2 border-b border-[var(--border)] px-5 py-2"
        >
          {["overview", "activity", "edit"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={
                "min-h-11 px-3 text-sm capitalize " +
                (tab === t ? "font-semibold text-text" : "text-text-muted")
              }
            >
              {t === "edit" ? "Edit details" : t}
            </button>
          ))}
        </nav>
      )}
      <div className="space-y-5 overflow-x-hidden overflow-y-auto p-5">
        {error && (
          <p role="alert" className="text-sm text-accent-red">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-accent-green">
            {notice}
          </p>
        )}
        {tab === "overview" && (
          <>
            <div className="space-y-2 text-sm">
              {target.phone && (
                <p>
                  <a href={"tel:" + target.phone} className="text-text">
                    {target.phone}
                  </a>
                </p>
              )}
              {target.email && (
                <p>
                  <a href={"mailto:" + target.email}>{target.email}</a>
                </p>
              )}
              {safeUrl(target.website) && (
                <a
                  className="inline-flex items-center gap-2"
                  href={safeUrl(target.website)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit website <ExternalLink size={14} />
                </a>
              )}
              {!target.phone && !target.email && (
                <p className="text-text-muted">
                  No contact details yet. Add them in Edit details.
                </p>
              )}
            </div>
            <section className="space-y-2 border-t border-[var(--border)] pt-4">
              <h3 className="font-medium">Where things stand</h3>
              <p className="text-sm">
                {target.kind === "citation"
                  ? outcomeLabel(
                      citationOutcome(target as OutreachTarget, activity),
                    )
                  : outcomeLabel(
                      target.promoted_at
                        ? "handed_off"
                        : target.qualified_at
                          ? "qualified"
                          : target.status || "identified",
                    )}
              </p>
              <p className="text-sm text-text-muted">
                {targetCalls[0]
                  ? targetCalls[0].agent +
                    " · " +
                    (targetCalls[0].status === "done"
                      ? "Call ended"
                      : targetCalls[0].status)
                  : latest
                    ? outcomeLabel(latest.outcome) + " · " + latest.worker
                    : "No work recorded yet."}
              </p>
              <p className="line-clamp-2 break-words text-sm">
                {technicalNotes
                  ? "Review the latest call, then choose the next step."
                  : target.notes || "No next step added yet."}
              </p>
              {(latest?.next_at || target.next_at) && (
                <p className="text-sm text-text-muted">
                  Follow up:{" "}
                  {new Date(
                    latest?.next_at || target.next_at || "",
                  ).toLocaleString()}
                </p>
              )}
              <button
                className={btnPrimaryCls}
                onClick={() => setTab("log")}
                disabled={!ready}
              >
                Log an update
              </button>
              {!ready && (
                <p className="text-sm text-text-muted">
                  Activity reporting needs its database update before new
                  outcomes can be saved.
                </p>
              )}
            </section>
            {target.kind === "business" && !testTarget && (
              <details>
                <summary className="cursor-pointer py-2 text-sm">
                  {target.qualified_at
                    ? "Qualified · PROXe handoff"
                    : "Qualify for PROXe"}
                </summary>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-text-muted">
                    Confirm a business need and an agreed next step. An answered
                    call or a request for information is not enough.
                  </p>
                  <Label name="Business need and agreed next step">
                    <textarea
                      rows={3}
                      className={inputCls}
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                    />
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={btnCls}
                      disabled={
                        !!busy || qualification.trim().length < 10 || !ready
                      }
                      onClick={() =>
                        action("qualify", async () => {
                          await request(
                            "/api/outreach/" + target.id + "/qualification",
                            { qualification_note: qualification },
                          );
                          setNotice(
                            "Qualification saved. You can now hand off to PROXe.",
                          );
                          onSaved();
                        })
                      }
                    >
                      Save qualification
                    </button>
                    {target.qualified_at && (
                      <button
                        className={btnPrimaryCls}
                        disabled={!!busy}
                        onClick={() =>
                          action("promote", async () => {
                            const d = await request(
                              "/api/outreach/" + target.id + "/promote",
                              {},
                            );
                            setNotice(
                              d.warning ||
                                "Handed to PROXe. No message was sent.",
                            );
                            onSaved();
                          })
                        }
                      >
                        {target.promoted_at
                          ? "Verify handoff"
                          : "Hand off to PROXe"}
                      </button>
                    )}
                  </div>
                </div>
              </details>
            )}
            {targetCalls.length > 0 && (
              <section className="border-t border-[var(--border)] pt-4">
                <h3 className="font-medium">Latest call</h3>
                <p className="my-2 text-sm text-text-muted">
                  {targetCalls[0].agent} · {targetCalls[0].duration}s
                </p>
                <button
                  className={btnCls}
                  onClick={() => onCall(targetCalls[0].id)}
                >
                  Play recording &amp; read transcript
                </button>
              </section>
            )}
            {target.notes && (
              <details>
                <summary className="cursor-pointer py-2 text-sm">
                  Saved notes
                </summary>
                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                  {target.notes}
                </p>
              </details>
            )}
            {target.why_them && (
              <details>
                <summary className="cursor-pointer py-2 text-sm">
                  Why this target
                </summary>
                <p className="text-sm leading-relaxed">{target.why_them}</p>
              </details>
            )}
            <details>
              <summary className="cursor-pointer py-2 text-sm">
                Research &amp; email tools
              </summary>
              <div className="space-y-3 pt-2">
                {target.research && (
                  <p className="whitespace-pre-wrap text-sm">
                    {target.research}
                  </p>
                )}
                <Label name="Draft instructions">
                  <input
                    className={inputCls}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </Label>
                <div className="flex flex-wrap gap-2">
                  {["research", "draft"].map((a) => (
                    <button
                      key={a}
                      className={btnCls}
                      disabled={!!busy}
                      onClick={() =>
                        action(a, async () => {
                          const d = await request(
                            "/api/outreach/" + target.id + "/" + a,
                            a === "draft" ? { instructions } : {},
                          );
                          setNotice(
                            a === "draft"
                              ? "Draft saved. " +
                                  (d.gmail === "drafted"
                                    ? "Available in Gmail Drafts."
                                    : "Gmail: " + d.gmail)
                              : "Research saved.",
                          );
                          onSaved();
                        })
                      }
                    >
                      {busy === a
                        ? "Working…"
                        : a === "draft"
                          ? "Draft email"
                          : "Research"}
                    </button>
                  ))}
                  <a
                    className={btnCls}
                    href="https://mail.google.com/mail/u/0/#drafts"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Gmail drafts
                  </a>
                </div>
                <Label name="Paste an email reply">
                  <textarea
                    rows={2}
                    className={inputCls}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </Label>
                <button
                  className={btnCls}
                  disabled={!!busy || !reply.trim()}
                  onClick={() =>
                    action("reply", async () => {
                      await request(
                        "/api/outreach/" + target.id + "/messages",
                        { direction: "in", channel: "email", body: reply },
                      );
                      setReply("");
                      setNotice("Reply logged.");
                      onSaved();
                    })
                  }
                >
                  Save reply
                </button>
              </div>
            </details>
            {target.phone && !testTarget && (
              <details>
                <summary className="cursor-pointer py-2 text-sm">
                  WhatsApp
                </summary>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-text-muted">
                    Only qualified contacts can be handed to PROXe. Check
                    availability before sending.
                  </p>
                  <Label name="Message">
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={wa}
                      onChange={(e) => setWa(e.target.value)}
                    />
                  </Label>
                  <div className="flex gap-2">
                    {[true, false].map((dry) => (
                      <button
                        key={String(dry)}
                        className={btnCls}
                        disabled={!!busy || !wa.trim()}
                        onClick={() =>
                          action("wa", async () => {
                            const d = await request(
                              "/api/outreach/" + target.id + "/whatsapp",
                              { text: wa, dry_run: dry },
                            );
                            setNotice(
                              dry
                                ? d.proxe?.window_open
                                  ? "Ready for a free-text message."
                                  : "Requires an approved template."
                                : d.proxe?.sent
                                  ? "Message sent."
                                  : "Message did not send.",
                            );
                            onSaved();
                          })
                        }
                      >
                        {dry ? "Check availability" : "Send WhatsApp"}
                      </button>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </>
        )}
        {tab === "activity" && (
          <>
            <p className="text-sm text-text-muted">
              Newest first. Call recordings come directly from the calling
              service.
            </p>
            {targetCalls.map((c) => (
              <button
                className="block w-full border-b border-[var(--border)] py-3 text-left"
                key={c.id}
                onClick={() => onCall(c.id)}
              >
                <span className="text-sm font-medium">
                  {c.agent} · {c.duration}s ·{" "}
                  {c.status === "done" ? "Ended" : c.status}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {new Date(c.started_at).toLocaleString()} ·{" "}
                  {c.has_audio ? "Recording & transcript" : "Review attempt"}
                </span>
              </button>
            ))}
            {activity.map((a) => (
              <details
                className="border-b border-[var(--border)] py-3"
                key={a.id}
              >
                <summary className="cursor-pointer text-sm">
                  <span className="capitalize">{a.channel}</span> ·{" "}
                  {outcomeLabel(a.outcome)}
                  <span className="mt-1 block text-xs text-text-muted">
                    {new Date(a.occurred_at).toLocaleString()} · {a.worker}
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {a.summary}
                </p>
                {safeUrl(a.evidence_url) && (
                  <a
                    className="mt-2 block text-sm underline"
                    href={safeUrl(a.evidence_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View evidence
                  </a>
                )}
              </details>
            ))}
            {!activity.length && !targetCalls.length && (
              <p className="text-sm">No activity recorded yet.</p>
            )}
          </>
        )}
        {tab === "log" && (
          <>
            <h3 className="font-medium">Log an update</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Label name="Work type">
                <select
                  className={inputCls}
                  value={channel}
                  onChange={(e) => {
                    const c = e.target.value as ActivityChannel;
                    setChannel(c);
                    setOutcome(OUTCOMES[c][0]);
                    setEventId(null);
                    setEventTime(null);
                  }}
                >
                  {Object.keys(OUTCOMES)
                    .filter(
                      (c) => c !== "citation" || target.kind === "citation",
                    )
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </Label>
              <Label name="Outcome">
                <select
                  className={inputCls}
                  value={outcome}
                  onChange={(e) => {
                    setOutcome(e.target.value);
                    setEventId(null);
                    setEventTime(null);
                  }}
                >
                  {OUTCOMES[channel].map((o) => (
                    <option key={o} value={o}>
                      {outcomeLabel(o)}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
            <Label name="What happened / next step">
              <textarea
                className={inputCls}
                rows={3}
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  setEventId(null);
                  setEventTime(null);
                }}
              />
            </Label>
            <Label
              name={
                outcome === "live"
                  ? "Public listing URL (required)"
                  : "Evidence URL (optional)"
              }
            >
              <input
                className={inputCls}
                value={evidence}
                onChange={(e) => {
                  setEvidence(e.target.value);
                  setEventId(null);
                  setEventTime(null);
                }}
              />
            </Label>
            <Label name="Follow-up date (optional)">
              <input
                type="datetime-local"
                className={inputCls}
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setEventId(null);
                  setEventTime(null);
                }}
              />
            </Label>
            <button
              className={btnPrimaryCls}
              disabled={!!busy || !summary.trim()}
              onClick={log}
            >
              {busy ? "Saving…" : "Save update"}
            </button>
          </>
        )}
        {tab === "edit" && (
          <div className="space-y-3">
            <Label name="Name">
              <input
                autoFocus={!target.id}
                className={inputCls}
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Label name="List type">
                <select
                  className={inputCls}
                  value={form.kind || "business"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      kind: e.target.value as OutreachTarget["kind"],
                    })
                  }
                >
                  {["business", "investor", "grant", "citation"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Label>
              {form.kind !== "citation" && (
                <Label name="Sales stage">
                  <select
                    className={inputCls}
                    value={form.status || "identified"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as OutreachTarget["status"],
                      })
                    }
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {outcomeLabel(s)}
                      </option>
                    ))}
                  </select>
                </Label>
              )}
              {(["phone", "email"] as const).map((k) => (
                <Label key={k} name={k === "phone" ? "Phone" : "Email"}>
                  <input
                    className={inputCls}
                    value={form[k] || ""}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </Label>
              ))}
            </div>
            <Label name="Next step / notes">
              <textarea
                rows={2}
                className={inputCls}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Label>
            <Label name="Follow-up date">
              <input
                type="date"
                className={inputCls}
                value={form.next_at?.slice(0, 10) || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    next_at: e.target.value
                      ? e.target.value + "T09:00:00+05:30"
                      : null,
                  })
                }
              />
            </Label>
            <details>
              <summary className="cursor-pointer py-2 text-sm">
                More details
              </summary>
              <div className="space-y-3 pt-2">
                {(
                  [
                    "org",
                    "segment",
                    "city",
                    "website",
                    "source",
                    "why_them",
                    "research",
                  ] as const
                ).map((k) => (
                  <Label key={k} name={k.replace(/_/g, " ")}>
                    <input
                      className={inputCls}
                      value={form[k] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
                    />
                  </Label>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
      <footer className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
        <button className={btnCls} disabled={!!busy} onClick={onClose}>
          Close
        </button>
        {tab === "edit" && (
          <button className={btnPrimaryCls} disabled={!!busy} onClick={save}>
            {busy ? "Saving…" : "Save details"}
          </button>
        )}
      </footer>
    </OutreachDialog>
  );
}
