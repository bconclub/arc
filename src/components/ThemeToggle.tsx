"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

/** `className` replaces the default look, e.g. a white icon on a dark pill over a photo. */
export function ThemeToggle({ className }: { className?: string } = {}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("arc:theme", next);
    } catch {}
  };

  // Avoid hydration mismatch, render a stable placeholder until mounted.
  if (!mounted) {
    return <div className={className || "w-8 h-8"} aria-hidden />;
  }

  return (
    <button
      onClick={toggle}
      className={className || "p-2 rounded-lg text-text-muted hover:text-text hover:bg-[var(--glow-white)] transition-all duration-150"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
