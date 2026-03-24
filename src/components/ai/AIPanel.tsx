"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";

interface AIPanelProps {
  title?: string;
  content?: string;
  streaming?: boolean;
  error?: string | null;
  onClose: () => void;
  children?: ReactNode;
}

export function AIPanel({ title = "AI Response", content, streaming, error, onClose, children }: AIPanelProps) {
  return (
    <div className="border border-accent-blue/15 bg-surface rounded-[14px] overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 py-3 border-b border-accent-blue/10 bg-accent-blue/[0.03]">
        <span className="text-xs font-medium text-accent-blue flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
          {title}
        </span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-text transition-all duration-150">
          <X size={14} />
        </button>
      </div>
      <div className="p-5">
        {error && (
          <p className="text-sm text-accent-red">{error}</p>
        )}
        {content && (
          <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
            {content}
            {streaming && <span className="inline-block w-1.5 h-4 bg-accent-blue ml-0.5 animate-pulse align-text-bottom rounded-sm" />}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
