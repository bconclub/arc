"use client";

import { useState } from "react";
import { Delete, Loader2 } from "lucide-react";

/** The door to the dialer: type your own 6-digit passcode and you are in. */
export function PinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(code: string) {
    setBusy(true); setError("");
    const r = await fetch("/api/dialer/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: code }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { window.location.reload(); return; }
    setBusy(false); setPin(""); setError(j.error || "Could not sign in. Try again.");
  }
  function press(k: string) {
    if (busy || pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 6) submit(next);
  }
  const key = "flex h-16 items-center justify-center rounded-soft border border-[var(--border)] text-[22px] font-semibold text-text hover:bg-[var(--surface-hover)] active:bg-[var(--surface-hover)]";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="flex w-full max-w-[320px] flex-col gap-4">
        <h1 className="flex items-center justify-center gap-2 text-[18px] font-bold tracking-tight text-text">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" /> PROXe Dialer
        </h1>
        <p className="text-center text-[13px] text-text-muted">Enter your passcode</p>
        <div className="flex justify-center gap-3" aria-label={`${pin.length} of 6 digits entered`}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full border ${i < pin.length ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--border)]"}`} />
          ))}
        </div>
        <input value={pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setPin(v); if (v.length === 6) submit(v); }}
          type="password" inputMode="numeric" autoComplete="one-time-code" autoFocus aria-label="Passcode" className="sr-only" />
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => <button key={k} type="button" className={key} onClick={() => press(k)}>{k}</button>)}
          <span />
          <button type="button" className={key} onClick={() => press("0")}>0</button>
          <button type="button" className={key} onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete last digit"><Delete size={20} /></button>
        </div>
        <p role="alert" className="min-h-[20px] text-center text-[13px] text-accent-red">
          {busy ? <Loader2 size={16} className="mx-auto animate-spin text-text-muted" /> : error}
        </p>
      </div>
    </div>
  );
}
