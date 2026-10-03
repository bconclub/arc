"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function InvestorLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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

  const inputCls =
    "w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-[15px] text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-panel border border-[var(--border)] bg-surface p-7 shadow-panel"
      >
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-text)]">PROXe</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-text">Investor Login</h1>
        </div>
        <input
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          aria-label="Username"
          className={inputCls}
        />
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className={`${inputCls} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-text-muted transition-colors hover:text-text"
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {error && <p className="text-[12.5px] text-accent-red">{error}</p>}
        <button
          type="submit"
          disabled={busy || !username || !password}
          className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-[15px] font-semibold text-[var(--brand-ink)] transition-opacity disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
