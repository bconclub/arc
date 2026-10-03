"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvestorLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/investor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not sign in.");
      return;
    }
    router.push("/investor");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-panel border border-[var(--border)] bg-surface p-8 shadow-panel"
      >
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-text)]">PROXe</p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-text">Investor view</h1>
          <p className="mt-1 text-[12.5px] text-text-muted">Where the money goes, what it is buying, and how the product is moving.</p>
        </div>
        <input
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]"
        />
        {error && <p className="text-[12.5px] text-accent-red">{error}</p>}
        <button
          type="submit"
          disabled={busy || !username || !password}
          className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition-opacity disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
