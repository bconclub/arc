"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquare, Send, X } from "lucide-react";

/**
 * The two-way layer on the dashboard.
 *
 * Type "Laptop Store M2 payment came in" and it answers with what it
 * understood and a confirm card; nothing touches a record until the card is
 * confirmed — the same propose→accept rule the invoice queue follows. Ask
 * "what's going on with WindChasers" and it answers from the same rollups
 * the panels use. A follow-up message refines the pending card in place.
 */

type IntentCard = {
  type: "intent";
  intentId: string;
  mutations: string[];
  candidates: { id: string; label: string }[];
};

type RecordCard = {
  type: "record";
  brand: { id: string; name: string } | null;
  stats: { label: string; value: string }[];
  timeline: { when: string; what: string }[];
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent_id?: string | null;
  card?: IntentCard | RecordCard | null;
  created_at?: string;
};

export function OpsChat({ onChanged }: { onChanged?: () => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyIntent, setBusyIntent] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [candidate, setCandidate] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/chat").then((r) => r.json()).catch(() => ({}));
    if (res.session) setSessionId(res.session.id);
    if (Array.isArray(res.messages)) {
      setMessages(res.messages);
      if (res.messages.length) setOpen(true);
    }
    setDetail(res.detail ?? "");
    // Anything not pending anymore renders as settled.
    if (res.messages) {
      const settled: Record<string, string> = {};
      for (const m of res.messages as Msg[]) {
        if (m.intent_id && (!res.pending || res.pending.id !== m.intent_id)) settled[m.intent_id] = "settled";
      }
      setResolved(settled);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true); setError(""); setOpen(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    const res = await fetch("/api/ops/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, text }),
    }).then((r) => r.json()).catch(() => ({ error: "The chat did not answer." }));
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    if (res.sessionId) setSessionId(res.sessionId);
    if (res.message) setMessages((prev) => [...prev, res.message]);
  }

  async function decide(intentId: string, action: "confirm" | "reject") {
    if (busyIntent) return;
    setBusyIntent(intentId); setError("");
    const res = await fetch(`/api/ops/chat/intents/${intentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, candidateId: candidate[intentId] || undefined }),
    }).then((r) => r.json()).catch(() => ({ error: "Could not apply that." }));
    setBusyIntent(null);
    if (res.error) { setError(res.error); return; }
    setResolved((prev) => ({ ...prev, [intentId]: res.status }));
    if (res.message) setMessages((prev) => [...prev, res.message]);
    if (action === "confirm") onChanged?.();
  }

  function renderCard(m: Msg) {
    const card = m.card;
    if (!card) return null;
    if (card.type === "record") {
      return (
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3">
          <div className="grid grid-cols-3 gap-2">
            {card.stats.map((s) => (
              <div key={s.label}>
                <p className="text-[9.5px] uppercase tracking-wide text-text-muted">{s.label}</p>
                <p className="text-[13px] font-semibold text-text">{s.value}</p>
              </div>
            ))}
          </div>
          {card.timeline.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-2">
              {card.timeline.slice(0, 6).map((t, i) => (
                <p key={i} className="text-[11px] text-text-muted">
                  <span className="mr-2 font-mono text-[9.5px] opacity-70">{(t.when ?? "").slice(0, 10)}</span>
                  {t.what}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (card.type === "intent") {
      const settled = resolved[card.intentId];
      return (
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3">
          {card.mutations.map((label) => (
            <p key={label} className="text-[12px] text-text">{label}</p>
          ))}
          {card.candidates.length > 0 && !settled && (
            <div className="mt-2 space-y-1">
              {card.candidates.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-[12px] text-text">
                  <input
                    type="radio"
                    name={`cand-${card.intentId}`}
                    checked={candidate[card.intentId] === c.id}
                    onChange={() => setCandidate((prev) => ({ ...prev, [card.intentId]: c.id }))}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
          {settled ? (
            <p className="mt-2 text-[11px] font-medium text-text-muted">
              {settled === "applied" ? "Applied." : settled === "rejected" ? "Rejected." : "Settled."}
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => decide(card.intentId, "confirm")}
                disabled={busyIntent === card.intentId || (card.candidates.length > 0 && !candidate[card.intentId])}
                className="flex items-center gap-1 rounded-lg bg-[var(--brand-soft)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--brand-text)] disabled:opacity-40"
              >
                {busyIntent === card.intentId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Confirm
              </button>
              <button
                onClick={() => decide(card.intentId, "reject")}
                disabled={busyIntent === card.intentId}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11.5px] text-text-muted hover:text-text disabled:opacity-40"
              >
                <X size={12} /> Leave it
              </button>
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">
        <MessageSquare size={15} className="text-text-muted" />
        <h2 className="text-[13px] font-semibold text-text">Tell ARC</h2>
        <span className="text-[10.5px] text-text-muted">
          {"“ISIVIS project is done” · “Laptop Store payment came in” · “what's going on with WindChasers?”"}
        </span>
      </div>

      {detail && <p className="mt-2 text-[11px] text-accent-orange">{detail}</p>}

      {open && messages.length > 0 && (
        <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto border-t border-[var(--border)] pt-3">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={
                m.role === "user"
                  ? "max-w-[85%] rounded-xl bg-[var(--brand-soft)] px-3 py-1.5 text-[12.5px] text-[var(--brand-text)]"
                  : "max-w-[85%] rounded-xl px-3 py-1.5 text-[12.5px] text-text"
              }>
                <p>{m.content}</p>
                {renderCard(m)}
              </div>
            </div>
          ))}
          {busy && <Loader2 size={14} className="animate-spin text-text-muted" />}
          <div ref={endRef} />
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-accent-red">{error}</p>}

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Drop an update or ask a question…"
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-[var(--border-strong)]"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="rounded-xl border border-[var(--border)] px-3 text-text-muted transition-colors hover:text-text disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </div>
    </section>
  );
}
