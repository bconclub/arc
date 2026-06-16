"use client";

import { useState } from "react";
import { Loader2, Copy, Check, Sparkles, X, MapPin, Target } from "lucide-react";
import { SEED_LEADS, PRODUCTS, OUTREACH_PLAN } from "@/lib/os-outreach";
import { STAGE_META, CHANNEL_LABEL, type Lead, type LeadStage } from "@/types/os";

type RegionFilter = "all" | "India" | "US";
type Tab = "leads" | "plan" | "products";

export default function OutreachPage() {
  const [tab, setTab] = useState<Tab>("leads");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [drafting, setDrafting] = useState<Lead | null>(null);

  const leads = SEED_LEADS.filter(
    (l) => (region === "all" || l.region === region) && (stageFilter === "all" || l.stage === stageFilter)
  ).sort((a, b) => b.fit - a.fit);

  const regions: RegionFilter[] = ["all", "India", "US"];
  const stages: (LeadStage | "all")[] = ["all", "new", "contacted", "replied", "booked", "cold"];

  return (
    <div className="min-h-[calc(100vh-120px)] px-6 py-4 pb-24 max-w-5xl">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-text">Outreach</h1>
        <p className="text-[13px] text-text-muted mt-0.5">
          who to reach, what to pitch, and the plan to do it
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-[var(--border)]">
        {([
          ["leads", `Leads (${SEED_LEADS.length})`],
          ["plan", "Plan"],
          ["products", "Products"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-all ${
              tab === t ? "border-text text-text" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* LEADS */}
      {tab === "leads" && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-1 mr-2">
              <MapPin size={13} className="text-text-muted" />
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`px-2.5 py-1 text-[12px] rounded-full transition-all ${
                    region === r ? "bg-text text-bg font-medium" : "text-text-muted hover:text-text bg-[var(--glow-white)]"
                  }`}
                >
                  {r === "all" ? "All regions" : r}
                </button>
              ))}
            </div>
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-2.5 py-1 text-[12px] rounded-full transition-all ${
                  stageFilter === s ? "bg-text text-bg font-medium" : "text-text-muted hover:text-text bg-[var(--glow-white)]"
                }`}
              >
                {s === "all" ? "All stages" : STAGE_META[s].label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {leads.map((lead) => {
              const stage = STAGE_META[lead.stage];
              return (
                <div key={lead.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0 w-10">
                      <span className="text-[15px] font-semibold text-text">{lead.fit}</span>
                      <span className="text-[9px] text-text-muted/60 uppercase">fit</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-text">{lead.name}</span>
                        <span className="text-[12px] text-text-muted">· {lead.company}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: stage.color, background: stage.bg }}>
                          {stage.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted/70 mt-0.5">
                        {lead.role} · {lead.industry} · {lead.region} · {CHANNEL_LABEL[lead.channel]}
                      </div>
                      <p className="text-[12px] text-text-muted mt-1.5 leading-relaxed">{lead.why}</p>
                    </div>
                    <button
                      onClick={() => setDrafting(lead)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium bg-text text-bg rounded-lg hover:opacity-90 transition-all shrink-0"
                    >
                      <Sparkles size={13} />
                      Draft
                    </button>
                  </div>
                </div>
              );
            })}
            {leads.length === 0 && (
              <div className="card p-8 text-center text-[13px] text-text-muted">No leads match this filter.</div>
            )}
          </div>
        </>
      )}

      {/* PLAN */}
      {tab === "plan" && (
        <div className="space-y-4">
          {OUTREACH_PLAN.map((block) => (
            <div key={block.title} className="card p-5">
              <div className="flex items-center gap-2 mb-1">
                <Target size={15} className="text-text-muted" />
                <h3 className="text-[15px] font-semibold text-text">{block.title}</h3>
              </div>
              <p className="text-[13px] text-text-muted mb-3 leading-relaxed">{block.detail}</p>
              <ol className="space-y-1.5">
                {block.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-text">
                    <span className="text-text-muted/50 shrink-0">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* PRODUCTS */}
      {tab === "products" && (
        <div className="space-y-4">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="card p-5">
              <h3 className="text-[16px] font-semibold text-text">{p.name}</h3>
              <p className="text-[13px] text-accent-blue mt-0.5 mb-2">{p.tagline}</p>
              <p className="text-[13px] text-text-muted leading-relaxed mb-3">{p.pitch}</p>
              <div className="text-[12px] text-text-muted">
                <span className="text-text-muted/60 uppercase text-[10px] tracking-wide">Best for</span>
                <p className="mt-0.5">{p.bestFor}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {drafting && <DraftModal lead={drafting} onClose={() => setDrafting(null)} />}
    </div>
  );
}

function DraftModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const [kind, setKind] = useState("first touch");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kinds = ["first touch", "follow up", "re-engage"];

  const draft = async () => {
    setLoading(true);
    setError(null);
    setMessage("");
    try {
      const product = PRODUCTS.find((p) => p.id === productId);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft-outreach",
          payload: {
            lead: { name: lead.name, company: lead.company, role: lead.role, industry: lead.industry, region: lead.region, why: lead.why },
            channel: lead.channel,
            product: product ? { name: product.name, pitch: product.pitch } : undefined,
            kind,
          },
        }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setMessage(json.data.message);
    } catch {
      setError("Draft failed. Try again.");
    }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card p-5 animate-modal">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-[15px] font-semibold text-text">Draft to {lead.name}</h3>
            <p className="text-[12px] text-text-muted">{lead.company} · {CHANNEL_LABEL[lead.channel]} · {lead.region}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-[var(--glow-white)]">
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text-muted block mb-1">Product</label>
            <div className="flex gap-1">
              {PRODUCTS.map((p) => (
                <button key={p.id} onClick={() => setProductId(p.id)}
                  className={`px-2.5 py-1 text-[12px] rounded-lg transition-all ${productId === p.id ? "bg-text text-bg font-medium" : "bg-[var(--glow-white)] text-text-muted hover:text-text"}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text-muted block mb-1">Type</label>
            <div className="flex gap-1">
              {kinds.map((k) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`px-2.5 py-1 text-[12px] rounded-lg capitalize transition-all ${kind === k ? "bg-text text-bg font-medium" : "bg-[var(--glow-white)] text-text-muted hover:text-text"}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output */}
        {message ? (
          <div className="bg-surface border border-[var(--border)] rounded-xl p-3 text-[13px] text-text leading-relaxed whitespace-pre-wrap min-h-[120px]">
            {message}
          </div>
        ) : (
          <div className="bg-surface border border-[var(--border)] rounded-xl p-3 text-[12px] text-text-muted/60 min-h-[120px] flex items-center justify-center text-center">
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Pick product + type, then draft. Written in your voice."}
          </div>
        )}
        {error && <p className="text-[12px] text-accent-red mt-2">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button onClick={draft} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-text text-bg text-[13px] font-medium rounded-xl hover:opacity-90 disabled:opacity-40 transition-all">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {message ? "Redraft" : "Draft message"}
          </button>
          {message && (
            <button onClick={copy}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] text-text-muted hover:text-text bg-[var(--glow-white)] rounded-xl transition-all">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
