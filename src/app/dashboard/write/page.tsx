"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Calendar, ArrowLeft, Sparkles, Bot } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAI } from "@/hooks/useAI";
import type { ScheduledPost } from "@/types/content-engine";
import { MODEL_NAMES, type AIModel } from "@/lib/ai-client";

type ContentFormat = "LinkedIn" | "X" | "Reel script" | "WhatsApp broadcast";

const FORMATS: ContentFormat[] = ["LinkedIn", "X", "Reel script", "WhatsApp broadcast"];

const CHANNEL_MAP: Record<ContentFormat, string> = {
  LinkedIn: "LinkedIn",
  X: "X",
  "Reel script": "Instagram",
  "WhatsApp broadcast": "WhatsApp",
};

function WritePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<ContentFormat>("LinkedIn");
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<AIModel>("claude");
  const [schedule, setSchedule] = useLocalStorage<ScheduledPost[]>("arc:schedule", []);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  
  const writeAI = useAI<string>();

  // Load from URL params
  useEffect(() => {
    const t = searchParams.get("topic");
    const c = searchParams.get("context");
    const u = searchParams.get("url");
    
    if (t) setTopic(t);
    if (c) setContext(c);
    if (u) setUrl(u);
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split("T")[0]);
  }, [searchParams]);

  // Generate draft on load if topic exists
  useEffect(() => {
    if (topic && !draft && !writeAI.loading && !writeAI.streamText) {
      generateDraft();
    }
  }, [topic]);

  const generateDraft = async () => {
    if (!topic) return;
    await writeAI.trigger(
      "write-post",
      {
        topic,
        context,
        format,
        model,
      },
      true
    );
  };

  // Update draft when AI streams
  useEffect(() => {
    if (writeAI.streamText) {
      setDraft(writeAI.streamText);
    }
  }, [writeAI.streamText]);

  const handleApprove = () => {
    setShowScheduleModal(true);
  };

  const handleSchedule = () => {
    if (!topic || !scheduleDate) return;
    
    const newPost: ScheduledPost = {
      id: `post-${Date.now()}`,
      topic,
      channel: CHANNEL_MAP[format],
      date: scheduleDate,
      time: scheduleTime,
      status: "scheduled",
      draft,
    };
    
    setSchedule([...schedule, newPost]);
    router.push("/dashboard/schedule");
  };

  if (!topic) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-4">No topic selected</p>
          <button
            onClick={() => router.push("/dashboard/feed")}
            className="px-4 py-2 bg-white text-black text-[13px] font-medium rounded-lg hover:bg-white/90"
          >
            Go to Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/dashboard/feed")}
          className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Write</h1>
        </div>
      </div>

      {/* Topic card */}
      <div className="card p-4 mb-5">
        <span className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5">Topic</span>
        <p className="text-[15px] font-medium text-text">{topic}</p>
        {url && (
          <p className="text-[11px] text-text-muted/60 mt-1 truncate">{url}</p>
        )}
      </div>

      {/* Format selector */}
      <div className="mb-4">
        <span className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">Format</span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`shrink-0 px-3 py-1.5 text-[12px] font-medium rounded-full transition-all ${
                format === f
                  ? "bg-white text-black"
                  : "bg-surface text-text-muted hover:text-text"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Model selector */}
      <div className="mb-5">
        <span className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">AI Model</span>
        <div className="flex items-center gap-2">
          {(Object.keys(MODEL_NAMES) as AIModel[]).map((m) => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className={`flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium rounded-full transition-all ${
                model === m
                  ? "bg-white text-black"
                  : "bg-surface text-text-muted hover:text-text"
              }`}
            >
              <Bot size={14} />
              {MODEL_NAMES[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Draft output */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Draft</span>
          {writeAI.loading && (
            <span className="text-[11px] text-text-muted flex items-center gap-1.5">
              <Sparkles size={12} className="animate-pulse" />
              Writing with {MODEL_NAMES[model]}...
            </span>
          )}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={writeAI.loading ? "" : "AI will write here..."}
          className="w-full min-h-[280px] bg-surface border border-white/[0.08] rounded-xl p-4 text-[14px] text-text leading-relaxed resize-none focus:border-white/20 focus:outline-none transition-colors"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleApprove}
          disabled={!draft.trim() || writeAI.loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-black text-[14px] font-medium rounded-xl hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          <Check size={16} />
          Approve + Schedule
        </button>
        <button
          onClick={generateDraft}
          disabled={writeAI.loading}
          className="px-4 py-3 text-[13px] text-text-muted hover:text-text bg-surface hover:bg-surface-hover rounded-xl transition-all disabled:opacity-50"
        >
          Regenerate
        </button>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-backdrop">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowScheduleModal(false)}
          />
          <div className="relative w-full max-w-sm card p-5 animate-modal">
            <h3 className="text-[15px] font-semibold text-text mb-4">Schedule Post</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full bg-bg border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-text focus:border-white/20 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5">
                  Time
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full bg-bg border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-text focus:border-white/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSchedule}
                disabled={!scheduleDate}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-black text-[13px] font-medium rounded-xl hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                <Calendar size={14} />
                Lock it in
              </button>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2.5 text-[13px] text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    }>
      <WritePageContent />
    </Suspense>
  );
}
