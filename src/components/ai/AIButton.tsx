"use client";

import { Sparkles } from "lucide-react";

interface AIButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  size?: "sm" | "md";
}

export function AIButton({ onClick, loading = false, label = "AI", size = "sm" }: AIButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg border transition-all duration-200
        border-accent-blue/20 text-accent-blue hover:bg-accent-blue/[0.08] hover:border-accent-blue/30 disabled:opacity-50 disabled:cursor-wait
        ${size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}
        ${loading ? "animate-pulse" : ""}
      `}
    >
      <Sparkles size={size === "sm" ? 12 : 14} className={loading ? "animate-spin" : ""} />
      {label}
    </button>
  );
}
