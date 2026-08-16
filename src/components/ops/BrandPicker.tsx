"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { inputCls } from "@/components/ops/Modal";
import type { Brand } from "@/types/ops";

/**
 * The combobox that replaces every free-text client input.
 *
 * A brand is created once, ever; after that it is selected, never typed —
 * typing filters on name and every alias, so "itelcomputer" still finds
 * Laptop Store. A name with no match offers one "Create brand" row rather
 * than silently minting another spelling of an existing client, which is the
 * exact failure ("Jamaicn Kitchen ") this component exists to end.
 *
 * onChange always reports the canonical name plus brand_id where one exists,
 * so rows keep the display text the rollups match on and gain the FK.
 */
export function BrandPicker({
  value,
  onChange,
  placeholder = "Type to find a brand…",
}: {
  value: string;
  onChange: (v: { client: string; brand_id: string | null }) => void;
  placeholder?: string;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    fetch("/api/ops/brands").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setBrands(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands.slice(0, 8);
    return brands
      .filter((b) =>
        b.name.toLowerCase().includes(q) ||
        (b.aliases ?? []).some((a) => String(a).toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [brands, query]);

  const exact = matches.some((b) => b.name.toLowerCase() === query.trim().toLowerCase());

  function pick(b: Brand) {
    onChange({ client: b.name, brand_id: b.id });
    setQuery(b.name);
    setOpen(false);
  }

  async function createBrand() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    const res = await fetch("/api/ops/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status: "prospect" }),
    }).then((r) => r.json()).catch(() => null);
    setCreating(false);
    if (res?.id) {
      setBrands((prev) => [...prev, res]);
      pick(res);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className={inputCls}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Free text still writes through so nothing breaks mid-typing; the
          // id attaches the moment a row is picked.
          onChange({ client: e.target.value, brand_id: null });
        }}
      />
      {open && (matches.length > 0 || query.trim()) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-surface shadow-2xl">
          {matches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => pick(b)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-text hover:bg-[var(--surface-hover)]"
            >
              <span>
                {b.name}
                {b.kind && b.kind !== "client" && (
                  <span className="ml-2 text-[10px] uppercase text-text-muted">{b.kind}</span>
                )}
              </span>
              {b.name === value && <Check size={13} className="text-text-muted" />}
            </button>
          ))}
          {!exact && query.trim() && (
            <button
              type="button"
              onClick={createBrand}
              disabled={creating}
              className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-left text-[13px] text-[var(--brand-text)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <Plus size={13} />
              {creating ? "Creating…" : `Create brand “${query.trim()}”`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
