"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle } from "lucide-react";
import { MiniMarkdown } from "@/components/team/MiniMarkdown";

/**
 * Getting started: the owner's playbook (what PROXe is, who buys it, prices,
 * how we sell, how to use ARC). The same text the Ask assistant answers from.
 */
export default function TeamStart() {
  const [pb, setPb] = useState<{ text: string; updated_at: string | null } | null>(null);
  useEffect(() => { fetch("/api/team/playbook").then((r) => r.json()).then(setPb).catch(() => setPb({ text: "", updated_at: null })); }, []);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Getting started</h1>
          <p className="text-[12.5px] text-text-muted">
            Everything you need to sell PROXe. Read it once end to end. Anything unclear, ask.
            {pb?.updated_at ? ` Updated ${new Date(pb.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.` : ""}
          </p>
        </div>
        <Link href="/team/ask" className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] hover:opacity-90">
          <MessageCircle size={15} /> Ask a question
        </Link>
      </header>
      <article className="rounded-panel border border-[var(--border)] bg-surface p-5 sm:p-7">
        {!pb ? (
          <div className="flex h-40 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
        ) : pb.text.trim() ? (
          <MiniMarkdown text={pb.text} />
        ) : (
          <p className="text-[13px] text-text-muted">The playbook hasn&apos;t been written yet. Z adds it from the Team page.</p>
        )}
      </article>
    </div>
  );
}
