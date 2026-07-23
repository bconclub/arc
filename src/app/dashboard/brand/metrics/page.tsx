"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, Plus, Trash2 } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";
import { Sparkline } from "@/components/brand/Sparkline";
import type { BrandMetric, BrandPlatform } from "@/types/ops";

const PLATFORMS: BrandPlatform[] = ["linkedin", "instagram", "x", "youtube", "tiktok"];
const PLATFORM_LABEL: Record<BrandPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
};

type FormState = { platform: BrandPlatform; recorded_on: string; followers: string; reach: string; engagement: string; notes: string };
const EMPTY: FormState = {
  platform: "linkedin",
  recorded_on: new Date().toISOString().slice(0, 10),
  followers: "", reach: "", engagement: "", notes: "",
};

function delta(curr: number | null, prev: number | null): string {
  if (curr == null || prev == null) return "";
  const d = curr - prev;
  if (d === 0) return "±0";
  return d > 0 ? `+${d.toLocaleString()}` : d.toLocaleString();
}

export default function BrandMetricsPage() {
  const [metrics, setMetrics] = useState<BrandMetric[]>([]);
  const [adding, setAdding] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/brand/metrics").then((r) => r.json());
    setMetrics(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const byPlatform = useMemo(() => {
    const map = new Map<BrandPlatform, BrandMetric[]>();
    for (const p of PLATFORMS) map.set(p, []);
    for (const m of metrics) map.get(m.platform)?.push(m);
    return map;
  }, [metrics]);

  async function save() {
    if (!adding) return;
    setSaving(true); setError("");
    const res = await fetch("/api/brand/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setAdding(null); load();
  }

  async function removeEntry(m: BrandMetric) {
    if (!confirm(`Delete ${m.platform} entry for ${m.recorded_on}?`)) return;
    await fetch(`/api/brand/metrics/${m.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6 px-1 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TrendingUp size={18} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Brand metrics</h1>
            <p className="mt-0.5 text-[13px] text-text-muted">Manual snapshots per platform — one entry per day</p>
          </div>
        </div>
        <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setAdding({ ...EMPTY }); }}>
          <Plus size={13} /> Add entry
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const rows = byPlatform.get(platform) ?? [];
          const latest = rows[rows.length - 1];
          const prev = rows[rows.length - 2];
          return (
            <div key={platform} className="rounded-card border border-[var(--border)] bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-text">{PLATFORM_LABEL[platform]}</p>
                <p className="text-[11px] text-text-muted">{latest ? latest.recorded_on : "no data"}</p>
              </div>
              {latest ? (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(
                      [
                        ["followers", latest.followers, prev?.followers ?? null],
                        ["reach", latest.reach, prev?.reach ?? null],
                        ["engagement", latest.engagement, prev?.engagement ?? null],
                      ] as const
                    ).map(([label, curr, prevVal]) => (
                      <div key={label}>
                        <p className="text-lg font-bold tabular-nums tracking-tight text-text">
                          {curr == null ? "—" : curr.toLocaleString()}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">
                          {label}
                          {delta(curr, prevVal) && (
                            <span className={` ml-1 ${String(delta(curr, prevVal)).startsWith("+") ? "text-accent-green" : "text-text-muted"}`}>
                              {delta(curr, prevVal)}
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Sparkline values={rows.map((r) => r.followers ?? NaN)} />
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-text-muted hover:text-text">
                      {rows.length} entries
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {[...rows].reverse().map((r) => (
                        <li key={r.id} className="flex items-center gap-2 text-[12px] tabular-nums text-text-muted">
                          <span>{r.recorded_on}</span>
                          <span>· {r.followers?.toLocaleString() ?? "—"} followers</span>
                          <button className="ml-auto hover:text-accent-red" onClick={() => removeEntry(r)}>
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <p className="mt-3 text-[12px] text-text-muted">No entries yet.</p>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <Modal title="Add metrics entry" onClose={() => setAdding(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <select className={inputCls} value={adding.platform} onChange={(e) => setAdding({ ...adding, platform: e.target.value as BrandPlatform })}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" className={inputCls} value={adding.recorded_on} onChange={(e) => setAdding({ ...adding, recorded_on: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Followers">
              <input type="number" className={inputCls} value={adding.followers} onChange={(e) => setAdding({ ...adding, followers: e.target.value })} />
            </Field>
            <Field label="Reach">
              <input type="number" className={inputCls} value={adding.reach} onChange={(e) => setAdding({ ...adding, reach: e.target.value })} />
            </Field>
            <Field label="Engagement">
              <input type="number" step="0.01" className={inputCls} value={adding.engagement} onChange={(e) => setAdding({ ...adding, engagement: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <input className={inputCls} value={adding.notes} onChange={(e) => setAdding({ ...adding, notes: e.target.value })} />
          </Field>
          <p className="text-[11px] text-text-muted">Same platform + date overwrites the existing entry.</p>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onCancel={() => setAdding(null)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
