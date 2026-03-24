"use client";

import { TopicBank } from "@/components/content/TopicBank";
import { ContentCalendar } from "@/components/content/ContentCalendar";
import { Drafts } from "@/components/content/Drafts";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAI } from "@/hooks/useAI";
import { defaultTopics } from "@/lib/content-defaults";
import { AIButton } from "@/components/ai/AIButton";
import { AIPanel } from "@/components/ai/AIPanel";
import type { Topic, CalendarEntry, Draft, Campaign, Pillar, Platform } from "@/types/content";
import type { AIGeneratedTopic } from "@/types/ai";

export default function ContentPage() {
  const [topics, setTopics] = useLocalStorage<Topic[]>("koex:topics", defaultTopics);
  const [calendar, setCalendar] = useLocalStorage<CalendarEntry[]>("koex:calendar", []);
  const [drafts, setDrafts] = useLocalStorage<Draft[]>("koex:drafts", []);
  const [campaigns] = useLocalStorage<Campaign[]>("koex:campaigns", []);

  const topicAI = useAI<AIGeneratedTopic[]>();

  const handleAddCalendar = (entry: CalendarEntry) => {
    setCalendar((prev) => [...prev, entry]);
    setTopics((prev) =>
      prev.map((t) => (t.id === entry.topicId ? { ...t, status: "scheduled" as const } : t))
    );
  };

  const handlePostToCalendar = (entry: CalendarEntry) => {
    setCalendar((prev) => [...prev, entry]);
  };

  const brainstorm = async () => {
    await topicAI.trigger("generate-topics", {
      existingTopics: topics.map((t) => t.title),
      platform: "All",
    });
  };

  const addAITopic = (t: AIGeneratedTopic) => {
    const newTopic: Topic = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: t.title,
      pillar: t.pillar as Pillar,
      status: "idea",
      platform: t.platform as Platform,
    };
    setTopics((prev) => [...prev, newTopic]);
  };

  const handleWritePost = async (draft: Draft) => {
    const result = await writeAI.trigger(
      "write-post",
      { topic: draft.title, platform: draft.platform, format: "Text Post", pillar: draft.pillar },
      true
    );
    if (result && typeof result === "string") {
      setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, body: result } : d)));
    }
  };

  const writeAI = useAI<string>();

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tighter">Content</h1>
        <AIButton onClick={brainstorm} loading={topicAI.loading} label="AI Brainstorm" />
      </div>

      {(topicAI.data || topicAI.loading) && (
        <AIPanel title="AI Topic Ideas" onClose={topicAI.reset} error={topicAI.error}>
          {topicAI.loading && !topicAI.data && (
            <div className="flex items-center gap-2 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-xs text-text-muted">Generating topics...</span>
            </div>
          )}
          {Array.isArray(topicAI.data) && (
            <div className="space-y-2">
              {topicAI.data.map((topic, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3.5 bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text">{topic.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue">{topic.pillar}</span>
                      <span className="text-[10px] text-text-muted">{topic.platform}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => addAITopic(topic)}
                    className="btn-primary px-3 py-1.5 text-[11px] font-medium bg-white text-black rounded-lg hover:bg-white/90 shrink-0"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </AIPanel>
      )}

      <div>
        <p className="section-heading mb-5">Topic Bank</p>
        <TopicBank topics={topics} onUpdate={setTopics} campaigns={campaigns} />
      </div>

      <div>
        <p className="section-heading mb-5">Calendar</p>
        <ContentCalendar entries={calendar} topics={topics} onAdd={handleAddCalendar} />
      </div>

      {(writeAI.streaming || writeAI.streamText) && (
        <AIPanel
          title="AI Writing"
          content={writeAI.streamText}
          streaming={writeAI.streaming}
          error={writeAI.error}
          onClose={writeAI.reset}
        />
      )}

      <div>
        <p className="section-heading mb-5">Drafts</p>
        <Drafts drafts={drafts} onUpdate={setDrafts} onPostToCalendar={handlePostToCalendar} onWriteWithAI={handleWritePost} aiWriting={writeAI.loading} />
      </div>
    </div>
  );
}
