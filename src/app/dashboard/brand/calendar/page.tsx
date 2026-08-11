"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus, Trash2, ArrowRight, Bot } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnCls, btnPrimaryCls } from "@/components/ops/Modal";
import type { ContentPlanItem, ContentPlanStatus, BrandPlatform } from "@/types/ops";

const STATUSES: ContentPlanStatus[] = ["idea", "draft", "scheduled", "posted"];
const PLATFORMS: BrandPlatform[] = ["linkedin", "instagram", "x", "youtube", "tiktok"];

type PlanRow = ContentPlanItem & {
  ideas?: { id: number; angle: string | null; status: string } | null;
  posts?: { id: number; status: string; scheduled_for: string | null; published_at: string | null; platform: string } | null;
};

type ArcIdea = { id: number; angle: string | null; status: string };

type FormState = { title: string; platform: BrandPlatform | ""; status: ContentPlanStatus; planned_date: string; notes: string; idea_id: number | null };
const EMPTY: FormState = { title: "", platform: "", status: "idea", planned_date: "", notes: "", idea_id: null };

export default function ContentCalendarPage() {
  const [items, setItems] = useState<PlanRow[]>([]);
  const [ideas, setIdeas] = useState<ArcIdea[]>([]);
  const [adding, setAdding] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [plan, ideaRes] = await Promise.all([
      fetch("/api/brand/plan").then((r) => r.json()),
      fetch("/api/arc/ideas").then((r) => r.json()).catch(() => null),
    ]);
    setItems(Array.isArray(plan) ? plan : []);
    const list = Array.isArray(ideaRes) ? ideaRes : Array.isArray(ideaRes?.ideas) ? ideaRes.ideas : [];
    setIdeas(list.filter((i: ArcIdea) => ["proposed", "approved"].includes(i.status)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const linkedIdeaIds = useMemo(() => new Set(items.map((i) => i.idea_id).filter(Boolean)), [items]);
  const unlinkedIdeas = ideas.filter((i) => !linkedIdeaIds.has(i.id));

  async function advance(item: PlanRow) {
    const next = STATUSES[Math.min(STATUSES.indexOf(item.status) + 1, STATUSES.length - 1)];
    if (next === item.status) return;
    await fetch(`/api/brand/plan/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function remove(item: PlanRow) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await fetch(`/api/brand/plan/${item.id}`, { method: "DELETE" });
    load();
  }

  async function pullIdea(idea: ArcIdea) {
    await fetch("/api/brand/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: idea.angle || `Idea #${idea.id}`, status: "idea", idea_id: idea.id }),
    });
    load();
  }

  async function save() {
    if (!adding || !adding.title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/brand/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setAdding(null); load();
  }

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={18} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Content calendar</h1>
            <p className="mt-0.5 text-[13px] text-text-muted">
              Planning overlay. Content itself lives in <Link href="/dashboard/arc" className="underline">ARC Agent</Link> and{" "}
              <Link href="/dashboard/write" className="underline">Write</Link>
            </p>
          </div>
        </div>
        <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setAdding({ ...EMPTY }); }}>
          <Plus size={13} /> New card
        </button>
      </div>

      {unlinkedIdeas.length > 0 && (
        <div className="rounded-card border border-[var(--border)] bg-surface p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <Bot size={13} /> Pull from ARC Agent
          </p>
          <div className="flex flex-wrap gap-2">
            {unlinkedIdeas.slice(0, 6).map((i) => (
              <button key={i.id} className={btnCls} onClick={() => pullIdea(i)}>
                + {(i.angle || `Idea #${i.id}`).slice(0, 60)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((status) => {
          const col = items.filter((i) => i.status === status);
          return (
            <div key={status} className="rounded-card border border-[var(--border)] bg-surface p-3">
              <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {status} <span className="tabular-nums">({col.length})</span>
              </p>
              <div className="space-y-2">
                {col.length === 0 && <p className="px-1 pb-2 text-[12px] text-text-muted">—</p>}
                {col.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] bg-bg/40 p-3">
                    <p className="text-[13px] font-medium text-text">{item.title}</p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {item.platform || "any platform"}
                      {item.planned_date && ` · ${item.planned_date}`}
                      {item.ideas && ` · from idea #${item.ideas.id}`}
                      {item.posts && ` · post ${item.posts.status}`}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {status !== "posted" && (
                        <button
                          className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-text-muted transition-all hover:bg-surface-hover hover:text-text"
                          onClick={() => advance(item)}
                        >
                          {STATUSES[STATUSES.indexOf(status) + 1]} <ArrowRight size={11} />
                        </button>
                      )}
                      <button className="ml-auto text-text-muted transition-colors hover:text-accent-red" onClick={() => remove(item)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <Modal title="New calendar card" onClose={() => setAdding(null)}>
          <Field label="Title">
            <input className={inputCls} value={adding.title} autoFocus onChange={(e) => setAdding({ ...adding, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <select className={inputCls} value={adding.platform} onChange={(e) => setAdding({ ...adding, platform: e.target.value as BrandPlatform })}>
                <option value="">any</option>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Planned date">
              <input type="date" className={inputCls} value={adding.planned_date} onChange={(e) => setAdding({ ...adding, planned_date: e.target.value })} />
            </Field>
          </div>
          <Field label="Status">
            <select className={inputCls} value={adding.status} onChange={(e) => setAdding({ ...adding, status: e.target.value as ContentPlanStatus })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea rows={2} className={inputCls} value={adding.notes} onChange={(e) => setAdding({ ...adding, notes: e.target.value })} />
          </Field>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onCancel={() => setAdding(null)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
