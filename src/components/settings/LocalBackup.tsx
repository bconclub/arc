"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";

/**
 * Export and restore the browser-local ARC state.
 *
 * These controls used to live in the top header. That header is gone, and this
 * is where they belonged anyway: they are settings, not something needed on
 * every screen.
 *
 * Scope is deliberately narrow. Only `arc:`-prefixed localStorage keys are
 * touched, so this is preferences and local UI state, NOT the database. Anything
 * in Supabase (invoices, projects, brands) is untouched by both buttons.
 */
export function LocalBackup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  function exportData() {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("arc:")) continue;
      try {
        data[key] = JSON.parse(localStorage.getItem(key)!);
      } catch {
        // A value that isn't JSON is still worth backing up verbatim.
        data[key] = localStorage.getItem(key);
      }
    }

    const count = Object.keys(data).length;
    if (count === 0) {
      setMessage("Nothing stored locally to export.");
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arc-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${count} setting${count === 1 ? "" : "s"}.`);
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      let data: unknown;
      try {
        data = JSON.parse(ev.target?.result as string);
      } catch {
        setMessage("That file is not valid JSON.");
        return;
      }
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        setMessage("That does not look like an ARC backup.");
        return;
      }

      const entries = Object.entries(data as Record<string, unknown>)
        .filter(([k]) => k.startsWith("arc:"));
      if (entries.length === 0) {
        setMessage("No ARC settings found in that file.");
        return;
      }

      // Restoring overwrites current settings, so it is confirmed rather than
      // silently applied on file pick.
      if (!confirm(`Restore ${entries.length} setting${entries.length === 1 ? "" : "s"}? This overwrites the current ones.`)) {
        return;
      }

      for (const [k, v] of entries) localStorage.setItem(k, JSON.stringify(v));
      setMessage("Restored. Reloading.");
      setTimeout(() => window.location.reload(), 600);
    };
    reader.readAsText(file);
  }

  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-4 shadow-card">
      <h2 className="text-[13.5px] font-semibold tracking-tight text-text">Local backup</h2>
      <p className="mt-0.5 text-[11.5px] text-text-muted">
        Saves settings held in this browser. Your invoices, projects and brands live in the
        database and are not part of this file.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={exportData}
          className="flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text transition-colors hover:bg-[var(--glow-white)]"
        >
          <Download size={13} /> Export settings
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text transition-colors hover:bg-[var(--glow-white)]"
        >
          <Upload size={13} /> Restore from file
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={importData} className="hidden" />
        {message && <span className="text-[11.5px] text-text-muted">{message}</span>}
      </div>
    </section>
  );
}
