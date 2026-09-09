"use client";
import { useState } from "react";
import { btnCls, btnPrimaryCls, inputCls } from "@/components/ops/Modal";
import { OutreachDialog } from "./OutreachDialog";
type Candidate = {
  org: string;
  website: string | null;
  city: string | null;
  segment: string | null;
  why_them: string;
};
export function SuggestTargets({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [segment, setSegment] = useState(""),
    [city, setCity] = useState("Bangalore"),
    [items, setItems] = useState<Candidate[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [searched, setSearched] = useState(false);
  async function request(url: string, body: unknown) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Request failed. Retry.");
    return d;
  }
  async function search() {
    setBusy(true);
    setError("");
    try {
      const d = await request("/api/outreach/suggest", { segment, city });
      setItems(d.candidates || []);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }
  async function add(c: Candidate) {
    setBusy(true);
    setError("");
    try {
      await request("/api/outreach", {
        ...c,
        name: c.org,
        kind: "business",
        source: "suggest",
      });
      setItems((prev) => prev.filter((i) => i !== c));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add target.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <OutreachDialog title="Find prospects" onClose={onClose}>
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] p-5">
        <h2 className="text-lg font-semibold">Find prospects</h2>
        <button className={btnCls} onClick={onClose}>
          Close
        </button>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5">
        <label className="block space-y-1 text-sm">
          Business type
          <input
            className={inputCls}
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            placeholder="Dental clinics"
          />
        </label>
        <label className="block space-y-1 text-sm">
          City
          <input
            className={inputCls}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </label>
        <button
          className={btnPrimaryCls}
          disabled={busy || !segment.trim()}
          onClick={search}
        >
          {busy ? "Working…" : "Find candidates"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-accent-red">
            {error}
          </p>
        )}
        {searched && !items.length && (
          <p className="text-sm text-text-muted">
            No candidates left. Try another search.
          </p>
        )}
        {items.map((c, i) => (
          <div
            key={i}
            className="space-y-2 border-t border-[var(--border)] pt-4"
          >
            <h3 className="font-medium">{c.org}</h3>
            <p className="text-sm text-text-muted">{c.why_them}</p>
            <button className={btnCls} disabled={busy} onClick={() => add(c)}>
              Add to list
            </button>
          </div>
        ))}
      </div>
    </OutreachDialog>
  );
}
