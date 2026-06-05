"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);

  const now = new Date();
  const formatted = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const exportData = () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("arc:")) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key)!);
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `arc-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        Object.entries(data).forEach(([key, value]) => {
          if (key.startsWith("arc:")) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });
        setShowImportSuccess(true);
        setTimeout(() => {
          setShowImportSuccess(false);
          window.location.reload();
        }, 800);
      } catch {
        alert("Invalid backup file");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <header className="sticky top-0 z-20 h-14 bg-bg/60 backdrop-blur-xl border-b border-[var(--border)] flex items-center justify-between px-5 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="text-sm font-bold tracking-tight text-text">ARC</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showImportSuccess && (
          <span className="text-xs text-accent-green animate-fade-in font-medium">Restored!</span>
        )}
        <ThemeToggle />
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-[var(--glow-white)] transition-all duration-150"
          title="Import backup"
        >
          <Upload size={15} />
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={importData} className="hidden" />
        <button
          onClick={exportData}
          className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-[var(--glow-white)] transition-all duration-150"
          title="Export all data"
        >
          <Download size={15} />
        </button>
        <div className="w-px h-4 bg-[rgba(255,255,255,0.08)] mx-1 hidden sm:block" />
        <span className="text-xs text-text-muted font-mono hidden sm:inline tracking-tight">{formatted}</span>
      </div>
    </header>
  );
}
