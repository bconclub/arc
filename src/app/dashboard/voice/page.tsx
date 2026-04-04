"use client";

import { useState, useEffect } from "react";
import { Sparkles, Save, Loader2, Bot } from "lucide-react";
import { getFullContext, setContext, type ContextKey } from "@/lib/context";
import { useAI } from "@/hooks/useAI";
import { MODEL_NAMES, type AIModel } from "@/lib/ai-client";

export default function VoicePage() {
  const [context, setContextState] = useState({
    about_me: "",
    voice_style: "",
    sample_posts: "",
    content_pillars: "Pain Points, Marketing Tips, Build Journey, Client Results",
    brain_system_prompt: "",
    preferred_model: "claude" as AIModel,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  const generateAI = useAI<{ prompt: string }>();

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    setLoading(true);
    const ctx = await getFullContext();
    setContextState({
      about_me: ctx.about_me,
      voice_style: ctx.voice_style,
      sample_posts: ctx.sample_posts,
      content_pillars: ctx.content_pillars,
      brain_system_prompt: ctx.brain_system_prompt,
      preferred_model: ctx.preferred_model || "claude",
    });
    setLoading(false);
  };

  const handleSave = async (key: ContextKey, value: string) => {
    setSaving(true);
    await setContext(key, value);
    setSaving(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await generateAI.trigger("generate-brain-prompt", { model: context.preferred_model }, false);
    setRegenerating(false);
  };

  useEffect(() => {
    if (generateAI.data?.prompt) {
      setContextState(prev => ({
        ...prev,
        brain_system_prompt: generateAI.data.prompt,
      }));
    }
  }, [generateAI.data]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Voice</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            Persistent context for all AI calls
          </p>
        </div>
      </div>

      {/* Model Selector */}
      <div className="card p-4 mb-4">
        <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-3">
          Preferred AI Model
        </label>
        <div className="flex items-center gap-3">
          {(Object.keys(MODEL_NAMES) as AIModel[]).map((model) => (
            <button
              key={model}
              onClick={() => {
                setContextState({ ...context, preferred_model: model });
                handleSave("preferred_model", model);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                context.preferred_model === model
                  ? "bg-white text-black"
                  : "bg-surface text-text-muted hover:text-text"
              }`}
            >
              <Bot size={16} />
              {MODEL_NAMES[model]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-muted/60 mt-2">
          This model will be used for all AI-generated content
        </p>
      </div>

      {/* About Me */}
      <div className="card p-4 mb-4">
        <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
          About Me
        </label>
        <textarea
          value={context.about_me}
          onChange={(e) => setContextState({ ...context, about_me: e.target.value })}
          onBlur={() => handleSave("about_me", context.about_me)}
          placeholder="Who are you? What's your story?"
          className="w-full min-h-[100px] bg-bg border border-white/[0.08] rounded-xl p-3 text-[13px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none resize-none"
        />
      </div>

      {/* Voice Style */}
      <div className="card p-4 mb-4">
        <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
          Voice Style
        </label>
        <textarea
          value={context.voice_style}
          onChange={(e) => setContextState({ ...context, voice_style: e.target.value })}
          onBlur={() => handleSave("voice_style", context.voice_style)}
          placeholder="How do you write? Raw, vulnerable, direct?"
          className="w-full min-h-[100px] bg-bg border border-white/[0.08] rounded-xl p-3 text-[13px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none resize-none"
        />
      </div>

      {/* Sample Posts */}
      <div className="card p-4 mb-4">
        <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
          Sample Posts (your best ones)
        </label>
        <textarea
          value={context.sample_posts}
          onChange={(e) => setContextState({ ...context, sample_posts: e.target.value })}
          onBlur={() => handleSave("sample_posts", context.sample_posts)}
          placeholder="Paste 2-3 posts that got great engagement..."
          className="w-full min-h-[200px] bg-bg border border-white/[0.08] rounded-xl p-3 text-[13px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none resize-none"
        />
      </div>

      {/* Content Pillars */}
      <div className="card p-4 mb-6">
        <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
          Content Pillars
        </label>
        <input
          type="text"
          value={context.content_pillars}
          onChange={(e) => setContextState({ ...context, content_pillars: e.target.value })}
          onBlur={() => handleSave("content_pillars", context.content_pillars)}
          className="w-full bg-bg border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-text focus:border-white/20 focus:outline-none"
        />
      </div>

      {/* Regenerate Button */}
      <button
        onClick={handleRegenerate}
        disabled={regenerating}
        className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black text-[14px] font-medium rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all mb-6"
      >
        {regenerating ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {regenerating ? "Generating..." : `Regenerate Brain Prompt (${MODEL_NAMES[context.preferred_model]})`}
      </button>

      {/* Generated Brain Prompt */}
      {context.brain_system_prompt && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] uppercase tracking-wider text-text-muted">
              Generated Brain Prompt
            </label>
            {saving && <span className="text-[11px] text-text-muted">Saving...</span>}
          </div>
          <div className="bg-surface rounded-xl p-4 text-[12px] text-text-muted leading-relaxed whitespace-pre-wrap">
            {context.brain_system_prompt}
          </div>
          <p className="text-[11px] text-text-muted/60 mt-3">
            This prompt is automatically used in every AI call. Update your voice settings above and regenerate to change it.
          </p>
        </div>
      )}
    </div>
  );
}
