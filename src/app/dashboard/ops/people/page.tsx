"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus, Search } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";
import { PersonRow, Avatar, channelParts } from "@/components/ops/PersonCard";
import type { Brand, Person } from "@/types/ops";

type FormState = {
  id?: string; name: string; role: string; org: string;
  relation: string; channel: string; notes: string; avatar_url: string;
};
const EMPTY: FormState = { name: "", role: "", org: "", relation: "", channel: "", notes: "", avatar_url: "" };

/** Offered in the editor. Relation is free text, so other values still work. */
const KNOWN = ["client", "prospect", "partner", "vendor"];

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [relFilter, setRelFilter] = useState("");

  const load = useCallback(async () => {
    const [p, b] = await Promise.all([
      fetch("/api/ops/people").then((r) => r.json()).catch(() => []),
      fetch("/api/ops/brands").then((r) => r.json()).catch(() => []),
    ]);
    setPeople(Array.isArray(p) ? p : []);
    setBrands(Array.isArray(b) ? b : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const brandById = useMemo(() => {
    const m = new Map<string, Brand>();
    brands.forEach((b) => m.set(b.id, b));
    return m;
  }, [brands]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter((p) => {
      if (relFilter && (p.relation ?? "").trim().toLowerCase() !== relFilter) return false;
      if (!needle) return true;
      return [p.name, p.role, p.org, p.relation, p.channel]
        .some((f) => (f ?? "").toLowerCase().includes(needle));
    });
  }, [people, q, relFilter]);

  /** Every relation the data actually holds, so a typo is still reachable. */
  const relations = useMemo(() => Array.from(new Set(
    people.map((p) => (p.relation ?? "").trim().toLowerCase()).filter(Boolean),
  )).sort(), [people]);

  function openPerson(p: Person) {
    setError("");
    setEditing({
      id: p.id, name: p.name, role: p.role ?? "", org: p.org ?? "",
      relation: p.relation ?? "", channel: p.channel ?? "", notes: p.notes ?? "",
      avatar_url: p.avatar_url ?? "",
    });
  }

  async function save() {
    if (!editing || !editing.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch(editing.id ? `/api/ops/people/${editing.id}` : "/api/ops/people", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setEditing(null); load();
  }

  async function remove() {
    if (!editing?.id || !confirm(`Delete "${editing.name}"?`)) return;
    setSaving(true);
    await fetch(`/api/ops/people/${editing.id}`, { method: "DELETE" });
    setSaving(false); setEditing(null); load();
  }

  const missingContact = people.filter((p) => {
    const c = channelParts(p.channel);
    return c.emails.length + c.phones.length + c.other.length === 0;
  }).length;

  return (
    <div className="page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Users size={18} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">People</h1>
            <p className="text-[11.5px] text-text-muted">
              {people.length} contact{people.length === 1 ? "" : "s"}
              {missingContact > 0 && (
                <span className="text-accent-orange"> · {missingContact} with no way to reach them</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people"
              className="w-44 rounded-pill border border-[var(--border)] bg-surface py-1.5 pl-7 pr-3 text-[12px] text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]"
            />
          </label>
          <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setEditing({ ...EMPTY }); }}>
            <Plus size={13} /> New person
          </button>
        </div>
      </div>

      {relations.length > 1 && (
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
          {[{ key: "", label: `All ${people.length}` },
            ...relations.map((r) => ({ key: r, label: `${titleCase(r)} ${people.filter((p) => (p.relation ?? "").trim().toLowerCase() === r).length}` }))
          ].map((t) => (
            <button
              key={t.key || "all"}
              onClick={() => setRelFilter(t.key)}
              className={`shrink-0 rounded-pill border px-3 py-1 text-[11.5px] font-medium transition-colors ${
                relFilter === t.key
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]"
                  : "border-[var(--border)] text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[12px] text-accent-red">{error}</p>}

      {people.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          No people yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          Nobody matches &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          {filtered.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              brand={p.brand_id ? brandById.get(p.brand_id) : undefined}
              onOpen={() => openPerson(p)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Edit person" : "New person"} onClose={() => setEditing(null)}>
          <Field label="Name">
            <input className={inputCls} value={editing.name} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <input className={inputCls} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
            </Field>
            <Field label="Org">
              <input className={inputCls} value={editing.org} onChange={(e) => setEditing({ ...editing, org: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Relation">
              <select className={inputCls} value={editing.relation} onChange={(e) => setEditing({ ...editing, relation: e.target.value })}>
                <option value="">No relation set</option>
                {Array.from(new Set([...KNOWN, editing.relation].filter(Boolean))).map((r) => (
                  <option key={r} value={r}>{titleCase(r)}</option>
                ))}
              </select>
            </Field>
            <Field label="Channel">
              <input className={inputCls} value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} />
            </Field>
          </div>
          <Field label="Photo URL">
            <div className="flex items-center gap-2.5">
              {/* Previewed against the same fallback the list uses, so a URL
                  that does not load is obvious here rather than later. */}
              <Avatar
                person={{ name: editing.name || "?", avatar_url: editing.avatar_url || null } as Person}
                size={38}
              />
              <input
                className={inputCls}
                placeholder="https://..."
                value={editing.avatar_url}
                onChange={(e) => setEditing({ ...editing, avatar_url: e.target.value })}
              />
            </div>
          </Field>
          <Field label="Notes">
            <textarea rows={3} className={inputCls} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          {relations.length > 1 && (
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
          {[{ key: "", label: `All ${people.length}` },
            ...relations.map((r) => ({ key: r, label: `${titleCase(r)} ${people.filter((p) => (p.relation ?? "").trim().toLowerCase() === r).length}` }))
          ].map((t) => (
            <button
              key={t.key || "all"}
              onClick={() => setRelFilter(t.key)}
              className={`shrink-0 rounded-pill border px-3 py-1 text-[11.5px] font-medium transition-colors ${
                relFilter === t.key
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]"
                  : "border-[var(--border)] text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onDelete={remove} onCancel={() => setEditing(null)} onSave={save} saving={saving} canDelete={!!editing.id} />
        </Modal>
      )}
    </div>
  );
}
