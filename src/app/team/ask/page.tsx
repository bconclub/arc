"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { MiniMarkdown } from "@/components/team/MiniMarkdown";

/**
 * Ask: a chat with the onboarding assistant. It answers from the playbook
 * (PROXe, prices, how we sell, how to use ARC) and knows your tasks and leads.
 * If the playbook doesn't say, it tells you to check with Z instead of guessing.
 */
type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Explain PROXe to me like I'm the customer",
  "What does PROXe cost and what's included?",
  "How should I open a call with an inbound lead?",
  "A clinic says it's too expensive. What do I say?",
  "What should I do first today?",
];

export default function TeamAsk() {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/team/chat").then((r) => r.json()).then((j) => setMsgs(j.messages || [])).catch(() => setMsgs([])); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const before = msgs || [];
    setMsgs([...before, { role: "user", content: question }]);
    setText(""); setBusy(true); setErr("");
    const r = await fetch("/api/team/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: question, history: before }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "No answer. Try again."); setMsgs(before); setText(question); return; }
    setMsgs([...before, { role: "user", content: question }, { role: "assistant", content: j.answer }]);
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-3">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-text">Ask</h1>
        <p className="text-[12.5px] text-text-muted">
          Ask anything about PROXe, our customers, prices, how to handle a call, or how to use this. It answers from Z&apos;s playbook and says so when it doesn&apos;t know.
        </p>
      </header>

      <section className="flex min-h-[50vh] flex-col gap-3 rounded-panel border border-[var(--border)] bg-surface p-4">
        {msgs === null ? (
          <div className="flex flex-1 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
        ) : !msgs.length ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-2">
            <p className="text-[12.5px] text-text-muted">Try one of these:</p>
            {STARTERS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-pill border border-[var(--border)] px-3 py-1.5 text-left text-[12.5px] text-text hover:border-[var(--brand-line)]">{s}</button>
            ))}
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-[var(--brand)] px-3.5 py-2 text-[13.5px] text-[var(--brand-ink)]" : "max-w-[92%]"}>
              {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <MiniMarkdown text={m.content} />}
            </div>
          ))
        )}
        {busy && <p className="flex items-center gap-2 text-[12.5px] text-text-muted"><Loader2 size={14} className="animate-spin" /> Thinking…</p>}
        <div ref={end} />
      </section>

      {err && <p className="text-[12.5px] text-accent-red">{err}</p>}
      <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex items-end gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Type your question" aria-label="Your question"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }}
          className="min-h-[48px] flex-1 resize-none rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13.5px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
        <button disabled={busy || !text.trim()} aria-label="Send"
          className="flex h-12 w-12 items-center justify-center rounded-soft bg-[var(--brand)] text-[var(--brand-ink)] disabled:opacity-40">
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
