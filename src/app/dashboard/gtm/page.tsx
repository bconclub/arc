"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { Modal, Field, ModalActions, inputCls } from "@/components/ops/Modal";
import type { GtmArea, GtmStatus, GtmItem } from "@/types/ops";

const STATUS_META: Record<GtmStatus, { label: string; dot: string; text: string }> = {
  not_started: { label: "not started", dot: "bg-text-muted", text: "text-text-muted" },
  in_progress: { label: "in progress", dot: "bg-accent-orange", text: "text-accent-orange" },
  defined: { label: "defined", dot: "bg-accent-blue", text: "text-accent-blue" },
  validated: { label: "validated", dot: "bg-accent-green", text: "text-accent-green" },
};
const STATUSES: GtmStatus[] = ["not_started", "in_progress", "defined", "validated"];

// The fixed GTM taxonomy: each area + the concrete sub-items inside it.
// Renders always (even before the DB is seeded); the DB overlays each item's
// status + the area's notes on top.
const GTM_SCAFFOLD: { slug: string; title: string; what: string; items: string[] }[] = [
  { slug: "foundation", title: "Foundation", what: "Who we serve and why we exist.", items: ["Market Definition", "ICP Development", "Buyer Personas", "Jobs To Be Done", "TAM / SAM / SOM"] },
  { slug: "positioning", title: "Positioning", what: "How we're seen vs alternatives.", items: ["Value Proposition", "Differentiation", "Category Design", "Competitive Positioning", "Positioning Statement"] },
  { slug: "messaging", title: "Messaging", what: "What we say and how.", items: ["Core Narrative", "Messaging Framework", "Taglines", "Objection Handling", "Message Testing"] },
  { slug: "pricing", title: "Pricing", what: "How we package and charge.", items: ["Pricing Research", "Packaging Tiers", "Pricing Metrics", "Discount Policy", "Pricing Page"] },
  { slug: "channels", title: "Channels", what: "Where we reach buyers.", items: ["Channel Strategy", "Inbound", "Outbound", "Partnerships", "Channel Testing"] },
  { slug: "sales_motion", title: "Sales Motion", what: "How deals get done.", items: ["Self Serve", "Sales Led", "Product Led", "Sales Playbook", "Demo Scripts"] },
  { slug: "content_engine", title: "Content Engine", what: "What we publish to pull demand.", items: ["Content Strategy", "SEO Content", "Case Studies", "Lead Magnets", "Sales Enablement"] },
  { slug: "launch_plan", title: "Launch Plan", what: "How we ship to market.", items: ["Launch Tiers", "Launch Timeline", "Press & PR", "Launch Assets", "Internal Alignment"] },
  { slug: "demand_generation", title: "Demand Generation", what: "How we create pipeline.", items: ["Paid Ads", "Email Campaigns", "Webinars", "Events", "Social Selling", "ABM Campaigns"] },
  { slug: "pipeline", title: "Pipeline", what: "How leads move.", items: ["Lead Scoring", "Lead Routing", "Qualification Framework", "CRM Setup", "Pipeline Reviews"] },
  { slug: "conversion", title: "Conversion", what: "How we close.", items: ["Trial Optimization", "Sales Process", "Proposal Templates", "Negotiation", "Closing Playbook"] },
  { slug: "customer_success", title: "Customer Success", what: "How we retain and grow.", items: ["Onboarding Flow", "Success Milestones", "QBRs", "Renewal Strategy", "Advocacy Program"] },
  { slug: "metrics", title: "Metrics", what: "How we measure.", items: ["CAC & LTV", "Funnel Metrics", "Attribution", "GTM Dashboard", "Win Loss Analysis"] },
  { slug: "expansion_revenue", title: "Expansion Revenue", what: "How we grow accounts.", items: ["Upsell Plays", "Cross Sell", "Seat Expansion", "Usage Expansion", "Enterprise Motion"] },
  { slug: "optimization", title: "Optimization", what: "How we improve.", items: ["A/B Testing", "Funnel Fixes", "Message Iteration", "Channel Doubling Down", "Kill List"] },
  { slug: "scale", title: "Scale", what: "How we expand the machine.", items: ["New Segments", "New Geographies", "GTM Team Hiring", "RevOps", "Repeatable Playbooks"] },
];

type MergedArea = {
  id: string | null;
  slug: string;
  title: string;
  what: string;
  stand: string;
  status: GtmStatus;
  items: GtmItem[];
};
type FormState = { id: string | null; slug: string; title: string; what: string; stand: string; status: GtmStatus; items: GtmItem[] };

// an area's rollup status = the lowest-common progress of its items
function rollup(items: GtmItem[]): { done: number; total: number } {
  const total = items.length;
  const done = items.filter((i) => i.status === "defined" || i.status === "validated").length;
  return { done, total };
}

export default function GtmPage() {
  const [areas, setAreas] = useState<MergedArea[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/gtm").then((r) => r.json()).catch(() => null);
    const rows: GtmArea[] = Array.isArray(data) ? data : [];
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    setAreas(GTM_SCAFFOLD.map((s) => {
      const row = bySlug.get(s.slug);
      const dbItems = new Map((row?.items ?? []).map((it) => [it.name, it.status]));
      return {
        id: row?.id ?? null,
        slug: s.slug,
        title: s.title,
        what: s.what,
        stand: row?.stand ?? "",
        status: (row?.status as GtmStatus) ?? "not_started",
        items: s.items.map((name) => ({ name, status: (dbItems.get(name) as GtmStatus) ?? "not_started" })),
      };
    }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const seeded = areas.some((a) => a.id);

  const totals = useMemo(() => {
    let done = 0, total = 0;
    for (const a of areas) { const r = rollup(a.items); done += r.done; total += r.total; }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [areas]);

  async function save() {
    if (!editing) return;
    if (!editing.id) { setError("Run the GTM migration first — then your status + notes will save here."); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/gtm/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stand: editing.stand, status: editing.status, items: editing.items }),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setEditing(null); load();
  }

  function setItemStatus(i: number, status: GtmStatus) {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.map((it, idx) => (idx === i ? { ...it, status } : it)) });
  }

  return (
    <div className="space-y-6 px-1 pb-24">
      <div className="flex items-center gap-2.5">
        <Target size={18} className="text-text-muted" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Go-To-Market</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            The 16 GTM areas the twin is grounded on — each broken into concrete pieces, tracked from not started to validated.
          </p>
        </div>
      </div>

      {/* Overall progress across all sub-items */}
      <div className="rounded-card border border-[var(--border)] bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-text">{totals.pct}% of the GTM defined or validated</span>
          <span className="text-[12px] tabular-nums text-text-muted">{totals.done} / {totals.total} pieces</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${totals.pct}%` }} />
        </div>
      </div>

      {!seeded && (
        <div className="rounded-card border border-[var(--border)] bg-[var(--glow-white)] px-4 py-3 text-[12px] text-text-muted">
          Showing the full GTM structure below. Run the migration in Supabase to start saving each piece&apos;s status.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((a) => {
          const r = rollup(a.items);
          return (
            <button
              key={a.slug}
              onClick={() => { setError(""); setEditing({ id: a.id, slug: a.slug, title: a.title, what: a.what, stand: a.stand, status: a.status, items: a.items }); }}
              className="flex flex-col rounded-card border border-[var(--border)] bg-surface p-4 text-left transition-all hover:border-[var(--border-strong)] hover:bg-surface-hover"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold text-text">{a.title}</span>
                <span className="text-[11px] tabular-nums text-text-muted">{r.done}/{r.total}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-text-muted">{a.what}</p>
              <ul className="mt-2.5 space-y-1.5 border-t border-[var(--border)] pt-2.5">
                {a.items.map((it) => (
                  <li key={it.name} className="flex items-center gap-2 text-[12px]">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_META[it.status].dot}`} />
                    <span className={it.status === "not_started" ? "text-text-muted" : "text-text"}>{it.name}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {editing && (
        <Modal title={editing.title} onClose={() => setEditing(null)}>
          <p className="mb-4 text-[12px] leading-relaxed text-text-muted">{editing.what}</p>

          <Field label="Pieces — set where each stands">
            <div className="space-y-1.5">
              {editing.items.map((it, i) => (
                <div key={it.name} className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[it.status].dot}`} />
                  <span className="flex-1 text-[13px] text-text">{it.name}</span>
                  <select
                    className={`${inputCls} w-40 shrink-0`}
                    value={it.status}
                    onChange={(e) => setItemStatus(i, e.target.value as GtmStatus)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Notes — where we stand overall">
            <textarea
              rows={4}
              className={inputCls}
              placeholder="Context, decisions, links, next moves for this area…"
              value={editing.stand}
              onChange={(e) => setEditing({ ...editing, stand: e.target.value })}
            />
          </Field>

          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onCancel={() => setEditing(null)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
