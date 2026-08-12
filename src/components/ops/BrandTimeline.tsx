"use client";

import { useMemo } from "react";
import {
  CheckCircle2, FileText, FolderKanban, IndianRupee, Radar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { money } from "@/lib/format";
import type { OpsSignal, Payment, Project, Proposal } from "@/types/ops";

type Entry = {
  id: string;
  date: string;
  title: string;
  detail?: string | null;
  amount?: number | null;
  kind: "project" | "invoice" | "paid" | "proposal" | "signal";
};

const STYLE: Record<Entry["kind"], { icon: LucideIcon; color: string; label: string }> = {
  project: { icon: FolderKanban, color: "#8b5cf6", label: "Project" },
  invoice: { icon: IndianRupee, color: "#f59e0b", label: "Invoice raised" },
  paid: { icon: CheckCircle2, color: "#00d4aa", label: "Paid" },
  proposal: { icon: FileText, color: "#3b82f6", label: "Proposal" },
  signal: { icon: Radar, color: "#e5484d", label: "Signal" },
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Everything that has happened with this brand, newest first.
 *
 * The history was spread across four separate lists, so answering "what have we
 * actually done for these people" meant reading all four and merging them in
 * your head. Anything with no date is left out rather than being stacked at one
 * end, where it would read as having happened then.
 */
export function BrandTimeline({
  projects, payments, proposals, signals,
}: {
  projects: Project[];
  payments: Payment[];
  proposals: Proposal[];
  signals: OpsSignal[];
}) {
  const entries = useMemo(() => {
    const out: Entry[] = [];

    for (const p of projects) {
      const date = p.start_date ?? p.created_at?.slice(0, 10);
      if (date) {
        out.push({
          id: `pr-${p.id}`, date, kind: "project",
          title: p.name,
          detail: p.end_date ? `Ran to ${p.end_date}` : p.status === "done" ? "Completed" : `Status: ${p.status}`,
          amount: p.budget,
        });
      }
    }

    for (const p of payments) {
      const raised = p.created_at?.slice(0, 10);
      if (raised) {
        out.push({
          id: `in-${p.id}`, date: raised, kind: "invoice",
          title: p.item || "Invoice", amount: p.amount,
        });
      }
      // Payment is its own event: the day the money landed is not the day the
      // invoice went out, and both are worth seeing.
      if (p.status === "paid" && p.paid_at) {
        out.push({
          id: `pd-${p.id}`, date: p.paid_at, kind: "paid",
          title: p.item || "Invoice", amount: p.amount,
        });
      }
    }

    for (const p of proposals) {
      const date = p.sent ?? p.created_at?.slice(0, 10);
      if (date) {
        out.push({
          id: `pp-${p.id}`, date, kind: "proposal",
          title: p.name, detail: p.status, amount: p.amount,
        });
      }
    }

    for (const s of signals) {
      const date = s.ts?.slice(0, 10);
      if (date) {
        out.push({ id: `sg-${s.id}`, date, kind: "signal", title: s.title, detail: s.severity });
      }
    }

    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [projects, payments, proposals, signals]);

  const months = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = monthKey(e.date);
      const list = map.get(k);
      if (list) list.push(e); else map.set(k, [e]);
    }
    return Array.from(map.entries());
  }, [entries]);

  if (entries.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-[var(--border)] px-4 py-8 text-center text-[12.5px] text-text-muted">
        Nothing dated to show yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {months.map(([key, items]) => (
        <div key={key}>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="shrink-0 text-[12px] font-semibold text-text">{monthLabel(key)}</h3>
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">
              {items.length} event{items.length === 1 ? "" : "s"}
            </span>
          </div>

          <ol className="relative space-y-2 pl-6">
            {/* The thread the markers sit on. */}
            <span className="absolute bottom-2 left-[9px] top-2 w-px bg-[var(--border)]" aria-hidden />
            {items.map((e) => {
              const s = STYLE[e.kind];
              return (
                <li key={e.id} className="relative">
                  <span
                    className="absolute -left-6 top-2 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-[var(--surface)]"
                    style={{ background: `${s.color}22` }}
                  >
                    <s.icon size={10} style={{ color: s.color }} strokeWidth={2.4} />
                  </span>
                  <div className="rounded-soft border border-[var(--border)] bg-surface p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug text-text">{e.title}</p>
                      {e.amount != null && (
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-text">{money(e.amount)}</span>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-text-muted">
                      <span style={{ color: s.color }}>{s.label}</span>
                      <span className="tabular-nums">
                        {new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                      {e.detail && <span className="capitalize">{e.detail}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
