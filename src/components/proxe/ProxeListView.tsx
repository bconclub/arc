"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, LucideIcon } from "lucide-react";

type ProxeItem = {
  id: string;
  kind: string;
  brand: string;
  brief_date: string;
  title: string;
  body_md: string;
  totals: Record<string, number>;
  source: string;
  created_at: string;
};

const BRANDS = ["all", "bcon", "windchasers", "lokazen", "pop", "proxe"] as const;

const BRAND_DOT: Record<string, string> = {
  bcon: "bg-accent-blue",
  windchasers: "bg-accent-green",
  lokazen: "bg-accent-orange",
  pop: "bg-accent-red",
  proxe: "bg-text-muted",
};

// Minimal markdown -> HTML. Briefs use a known, small subset (##, **, -, ---).
function renderMd(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-surface-hover text-[0.85em]">$1</code>');
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^---+$/.test(line)) { closeList(); out.push('<hr class="my-3 border-border"/>'); continue; }
    if (/^###\s+/.test(line)) { closeList(); out.push(`<h4 class="mt-4 mb-1 font-semibold text-sm">${inline(line.replace(/^###\s+/, ""))}</h4>`); continue; }
    if (/^##\s+/.test(line)) { closeList(); out.push(`<h3 class="mt-5 mb-1.5 font-semibold text-[0.95rem] text-text">${inline(line.replace(/^##\s+/, ""))}</h3>`); continue; }
    if (/^#\s+/.test(line)) { closeList(); out.push(`<h2 class="mt-2 mb-2 font-bold text-lg">${inline(line.replace(/^#\s+/, ""))}</h2>`); continue; }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul class="list-disc pl-5 space-y-1 my-1.5">'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (line === "") { closeList(); continue; }
    closeList();
    out.push(`<p class="my-1.5 leading-relaxed">${inline(line)}</p>`);
  }
  closeList();
  return out.join("");
}

type ProxeListViewProps = {
  kind: "brief" | "issue" | "update";
  icon: LucideIcon;
  title: string;
  description: string;
  emptyMessage: string;
};

export default function ProxeListView({ kind, icon: Icon, title, description, emptyMessage }: ProxeListViewProps) {
  const [items, setItems] = useState<ProxeItem[]>([]);
  const [brand, setBrand] = useState<(typeof BRANDS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ kind });
    if (brand !== "all") params.set("brand", brand);
    const data = await fetch(`/api/proxe/briefs?${params}`).then((r) => r.json()).catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [brand, kind]);

  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => {
    const m = new Map<string, ProxeItem[]>();
    for (const item of items) {
      if (!m.has(item.brief_date)) m.set(item.brief_date, []);
      m.get(item.brief_date)!.push(item);
    }
    return Array.from(m.entries());
  }, [items]);

  return (
    <div className="max-w-dashboard mx-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-1">
        <Icon className="w-5 h-5 text-text-muted" />
        <h1 className="text-xl font-bold text-text">{title}</h1>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <p className="text-sm text-text-muted mb-5">
        {description}
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {BRANDS.map((b) => (
          <button
            key={b}
            onClick={() => setBrand(b)}
            className={`px-3 py-1.5 rounded-full text-sm capitalize transition-all ${
              brand === b ? "bg-text text-bg font-medium" : "bg-surface text-text-muted hover:bg-surface-hover"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {loading && items.length === 0 && (
        <div className="text-sm text-text-muted py-10 text-center">Loading {kind}s…</div>
      )}

      {!loading && items.length === 0 && (
        <div className="border border-border rounded-card p-8 text-center">
          <p className="text-text-muted text-sm">
            {emptyMessage}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {byDate.map(([date, dateItems]) => (
          <div key={date}>
            <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">{date}</div>
            <div className="grid gap-3">
              {dateItems.map((item) => {
                const open = openId === item.id;
                return (
                  <div key={item.id} className="border border-border rounded-card overflow-hidden bg-surface">
                    <button
                      onClick={() => setOpenId(open ? null : item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full ${BRAND_DOT[item.brand] || "bg-text-muted"}`} />
                      <span className="font-medium text-sm capitalize text-text">{item.brand}</span>
                      <span className="text-sm text-text-muted truncate">{item.title}</span>
                      <span className="ml-auto flex items-center gap-2 text-xs text-text-muted shrink-0">
                        {typeof item.totals?.new_leads === "number" && <span>{item.totals.new_leads} leads</span>}
                        {typeof item.totals?.conversations_with_summary === "number" && (
                          <span>· {item.totals.conversations_with_summary} convos</span>
                        )}
                      </span>
                    </button>
                    {open && (
                      <div
                        className="px-4 pb-4 pt-1 text-sm text-text border-t border-border"
                        dangerouslySetInnerHTML={{ __html: renderMd(item.body_md) }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
