"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, Lightbulb, ImagePlus, Check, X, Plus, Sparkles } from "lucide-react";
import { getFullContext } from "@/lib/context";
import { supabase } from "@/lib/supabase";

interface InspirationPost {
  id: string;
  content: string;
  source: string;
  added_at: string;
}

interface StyleChange {
  type: "add" | "modify";
  title: string;
  detail: string;
}

interface StyleAnalysis {
  source: string;
  extractedText: string;
  patternName: string;
  summary: string;
  changes: StyleChange[];
  proposedGuide: string;
}

// Hardcoded identity — ARC knows who this is. Not editable.
const IDENTITY =
  "Thanzeel (Z), founder of PROXe and BCON Club. Solo builder running a 100-clients-in-90-days push. ICP: solo founders, coaching academies, clinics, real estate, tutoring centers in India losing leads to slow WhatsApp replies.";

export default function StylePage() {
  const [styleGuide, setStyleGuide] = useState("");
  const [loading, setLoading] = useState(true);

  // Inspiration input
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string>("image/png");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Proposed diff awaiting approval
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [inspirationPosts, setInspirationPosts] = useState<InspirationPost[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const ctx = await getFullContext();
    setStyleGuide(ctx.voice_style || "");
    await loadInspiration();
    setLoading(false);
  };

  const loadInspiration = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("inspiration_posts")
        .select("*")
        .order("added_at", { ascending: false });
      if (data) setInspirationPosts(data);
    } catch (e) {
      console.error("load inspiration:", e);
    }
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMediaType(file.type || "image/png");
    const reader = new FileReader();
    reader.onload = (ev) => setImageData(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const analyze = async () => {
    if (!text.trim() && !imageData) {
      setError("Paste a post or upload a screenshot first.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    setAnalysis(null);
    setRejected(new Set());
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze-style",
          payload: {
            text: text.trim() || undefined,
            imageBase64: imageData || undefined,
            imageMediaType,
            currentGuide: styleGuide,
          },
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setAnalysis(json.data as StyleAnalysis);
      }
    } catch {
      setError("Analysis failed. Try again.");
    }
    setAnalyzing(false);
  };

  // Accept the proposed guide (respecting any per-change rejections) and persist.
  const acceptDiff = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      // If some changes were rejected, ask the model is overkill — we keep the
      // full proposedGuide when nothing is rejected; otherwise we fall back to
      // appending only the accepted change details to the current guide.
      let merged = analysis.proposedGuide;
      if (rejected.size > 0) {
        const accepted = analysis.changes.filter((_, i) => !rejected.has(i));
        merged =
          (styleGuide ? styleGuide.trim() + "\n" : "") +
          accepted.map((c) => `- ${c.detail}`).join("\n");
      }
      await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-style-guide", payload: {}, guide: merged }),
      });
      // Save the source post into inspiration history
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("inspiration_posts").insert({
        content: analysis.extractedText,
        source: analysis.source,
      });
      setStyleGuide(merged);
      setAnalysis(null);
      setText("");
      setImageData(null);
      await loadInspiration();
    } catch {
      setError("Could not save. Try again.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("inspiration_posts").delete().eq("id", id);
      setInspirationPosts((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] px-6 py-4 pb-24 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-text">Style</h1>
        <p className="text-[13px] text-text-muted mt-0.5">
          How we write. Feed it posts you like — it learns and proposes changes you approve.
        </p>
      </div>

      {/* Identity (read-only, hardcoded) */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Who we are</span>
          <span className="text-[10px] text-text-muted/60">fixed</span>
        </div>
        <p className="text-[13px] text-text leading-relaxed">{IDENTITY}</p>
      </div>

      {/* Current Style Guide */}
      <div className="card p-4 mb-6">
        <span className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
          Current style guide
        </span>
        {styleGuide ? (
          <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">{styleGuide}</p>
        ) : (
          <p className="text-[13px] text-text-muted/60 italic">
            Empty. Add a post you like below to start building your style.
          </p>
        )}
      </div>

      {/* Add inspiration */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={16} className="text-text-muted" />
          <h2 className="text-[14px] font-medium text-text">Add a post you like</h2>
        </div>

        <div className="card p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a LinkedIn or Twitter/X post you liked… (or upload a screenshot below)"
            className="w-full min-h-[110px] bg-bg border border-white/[0.08] rounded-xl p-3 text-[13px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none resize-none mb-3"
          />

          {imageData && (
            <div className="relative inline-block mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageData} alt="screenshot" className="max-h-40 rounded-lg border border-white/10" />
              <button
                onClick={() => setImageData(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-bg border border-white/20 flex items-center justify-center text-text-muted hover:text-text"
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-hover rounded-lg transition-all"
            >
              <ImagePlus size={14} />
              Upload screenshot
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />

            <button
              onClick={analyze}
              disabled={analyzing || (!text.trim() && !imageData)}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium bg-white text-black rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {analyzing ? "Analyzing…" : "Analyze"}
            </button>
          </div>

          {error && <p className="text-[12px] text-accent-red mt-3">{error}</p>}
        </div>
      </div>

      {/* Proposed diff */}
      {analysis && (
        <div className="card p-4 mb-6 border border-accent-blue/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-accent-blue">Proposed changes</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted">
              from {analysis.source}
            </span>
            <span className="text-[10px] text-text-muted">· {analysis.patternName}</span>
          </div>
          <p className="text-[12px] text-text-muted mb-4">{analysis.summary}</p>

          <div className="space-y-2 mb-4">
            {analysis.changes.map((c, i) => {
              const isRejected = rejected.has(i);
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    isRejected
                      ? "border-white/[0.06] opacity-50"
                      : "border-accent-green/20 bg-accent-green/[0.04]"
                  }`}
                >
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                      c.type === "add"
                        ? "bg-accent-green/15 text-accent-green"
                        : "bg-accent-orange/15 text-accent-orange"
                    }`}
                  >
                    {c.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium text-text ${isRejected ? "line-through" : ""}`}>
                      {c.title}
                    </p>
                    <p className="text-[12px] text-text-muted mt-0.5">{c.detail}</p>
                  </div>
                  <button
                    onClick={() =>
                      setRejected((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-white/[0.06] transition-all shrink-0"
                    title={isRejected ? "Re-include" : "Reject this change"}
                  >
                    {isRejected ? <Plus size={14} /> : <X size={14} />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={acceptDiff}
              disabled={saving || rejected.size === analysis.changes.length}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-black text-[13px] font-medium rounded-xl hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {rejected.size > 0 ? "Apply accepted changes" : "Apply all changes"}
            </button>
            <button
              onClick={() => setAnalysis(null)}
              className="px-4 py-2.5 text-[13px] text-text-muted hover:text-text transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Inspiration history */}
      {inspirationPosts.length > 0 && (
        <div>
          <h2 className="text-[14px] font-medium text-text mb-3">Saved inspiration ({inspirationPosts.length})</h2>
          <div className="space-y-2">
            {inspirationPosts.map((p) => (
              <div key={p.id} className="card p-3 flex items-start justify-between gap-3 group">
                <div className="min-w-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-text-muted">
                    {p.source}
                  </span>
                  <p className="text-[12px] text-text-muted line-clamp-3 mt-1.5 whitespace-pre-wrap">{p.content}</p>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
