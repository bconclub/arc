"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus, Search } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";
import { PersonCard, channelParts } from "@/components/ops/PersonCard";
import type { Brand, Person } from "@/types/ops";

type FormState = { id?: string; name: string; role: string; org: string; relation: string; channel: string; notes: string };
const EMPTY: FormState = { name: "", role: "", org: "", relation: "", channel: "", notes: "" };

/**
 * The columns, in the order they matter. Anything with a relation outside this
 * list gets a column of its own rather than being hidden, since the field is
 * free text and a typo must not make a person disappear from the board.
 */
const KNOWN = ["client", "prospect", "partner", "vendor"];

const COLUMN_COLOR: Record<string, string> = {
  client: "#00d4aa",
  prospect: "#f59e0b",
  partner: "#8b5cf6",
  vendor: "#3b82f6",
};

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
  const [dragOver, setDragOver] = useState<string | null>(null);

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
    if (!needle) return people;
    return people.filter((p) =>
      [p.name, p.role, p.org, p.relation, p.channel].some((f) => (f ?? "").toLowerCase().includes(needle)),
    );
  }, [people, q]);

  // Known relations first in a fixed order, then anything else the data holds,
  // then the people carrying no relation at all.
  const columns = useMemo(() => {
    const extra = Array.from(new Set(
      filtered.map((p) => (p.relation ?? "").trim().toLowerCase()).filter((r) => r && !KNOWN.includes(r)),
    )).sort();
    const keys = [...KNOWN, ...extra];
    const cols = keys.map((key) => ({
      key,
      label: titleCase(key),
      color: COLUMN_COLOR[key] ?? "#6b6b6b",
      people: filtered.filter((p) => (p.relation ?? "").trim().toLowerCase() === key),
    }));
    const unset = filtered.filter((p) => !(p.relation ?? "").trim());
    if (unset.length) cols.push({ key: "", label: "No relation set", color: "#6b6b6b", people: unset });
    // An empty known column still shows, so dragging somebody into it is possible.
    return cols.filter((c) => c.people.length > 0 || KNOWN.includes(c.key));
  }, [filtered]);

  function openPerson(p: Person) {
    setError("");
    setEditing({
      id: p.id, name: p.name, role: p.role ?? "", org: p.org ?? "",
      relation: p.relation ?? "", channel: p.channel ?? "", notes: p.notes ?? "",
    });
  }

  /** Dropping onto a column is the same edit as retyping the relation field. */
  async function moveTo(id: string, relation: string) {
    const before = people;
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, relation: relation || null } : p)));
    const res = await fetch(`/api/ops/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relation: relation || null }),
    });
    if (!res.ok) { setPeople(before); setError("That move did not save."); }
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {columns.map((col) => (
            <section
              key={col.key || "unset"}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver((k) => (k === col.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveTo(id, col.key);
              }}
              className={`flex min-h-[120px] flex-col gap-2 rounded-panel border p-2.5 transition-colors ${
                dragOver === col.key
                  ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                  : "border-[var(--border)] bg-[var(--surface-hover)]"
              }`}
            >
              <div className="flex items-center gap-2 px-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.color }} />
                <h2 className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text">{col.label}</h2>
                <span className="shrink-0 text-[11px] tabular-nums text-text-muted">{col.people.length}</span>
              </div>

              {col.people.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  brand={p.brand_id ? brandById.get(p.brand_id) : undefined}
                  onOpen={() => openPerson(p)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                />
              ))}

              {col.people.length === 0 && (
                <p className="px-1 py-4 text-center text-[11px] text-text-muted">Drop somebody here.</p>
              )}
            </section>
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
          <Field label="Notes">
            <textarea rows={3} className={inputCls} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onDelete={remove} onCancel={() => setEditing(null)} onSave={save} saving={saving} canDelete={!!editing.id} />
        </Modal>
      )}
    </div>
  );
}
