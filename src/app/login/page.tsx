"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, username }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(username.trim() ? "Wrong name or password." : "Wrong password.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    // Studio and team logins only land on their own pages, whatever `next` asked for.
    const next = params.get("next");
    router.push(
      j.role === "studio" ? (next?.startsWith("/dashboard/studio") ? next : j.home)
      : j.role === "team" ? (next?.startsWith("/team") ? next : j.home)
      : next || "/dashboard",
    );
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-xs space-y-4 bg-surface/80 backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight text-text">ARC</span>
        <span className="text-[11px] text-text-muted">the twin</span>
      </div>
      <input
        type="text"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Your login name (team)"
        aria-label="Login name, for team accounts"
        className="w-full rounded-full border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]"
      />
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-full border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-text px-4 py-2.5 text-sm font-medium text-bg transition-opacity disabled:opacity-50"
      >
        {busy ? "…" : "Enter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
