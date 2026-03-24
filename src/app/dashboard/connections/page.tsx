"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { ConnectedSources } from "@/components/connections/ConnectedSources";
import { ListeningFeeds } from "@/components/connections/ListeningFeeds";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAI } from "@/hooks/useAI";
import { AIButton } from "@/components/ai/AIButton";
import { AIPanel } from "@/components/ai/AIPanel";
import { defaultSources, defaultFeeds } from "@/lib/connections-defaults";
import type { ConnectedSource, ListeningFeed } from "@/types/connections";
import type { AIDMScript } from "@/types/ai";

const DM_TARGETS = [
  "Coaching academy owners",
  "Clinic owners (dental/skin/physio)",
  "Real estate agents",
  "Tutoring center owners",
  "Solo founders",
];

export default function ConnectionsPage() {
  const [sources, setSources] = useLocalStorage<ConnectedSource[]>("koex:sources", defaultSources);
  const [feeds, setFeeds] = useLocalStorage<ListeningFeed[]>("koex:feeds", defaultFeeds);
  const [targetType, setTargetType] = useState(DM_TARGETS[0]);

  const dmAI = useAI<AIDMScript[]>();

  const generateDMs = async () => {
    await dmAI.trigger("generate-dms", { targetType });
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tighter">Connections</h1>
        <div className="flex items-center gap-2">
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-xs text-text transition-all"
          >
            {DM_TARGETS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <AIButton onClick={generateDMs} loading={dmAI.loading} label="Generate DMs" />
        </div>
      </div>

      {(dmAI.data || dmAI.loading || dmAI.error) && (
        <AIPanel title="DM Scripts" onClose={dmAI.reset} error={dmAI.error}>
          {dmAI.loading && !dmAI.data && (
            <div className="flex items-center gap-2 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-xs text-text-muted">Generating DM scripts...</span>
            </div>
          )}
          {Array.isArray(dmAI.data) && (
            <div className="space-y-3">
              {dmAI.data.map((dm, i) => (
                <div key={i} className="p-4 bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.05)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text">{dm.target}</span>
                      <span className="text-[10px] text-text-muted px-2 py-0.5 rounded-full bg-white/[0.04]">{dm.platform}</span>
                    </div>
                    <button
                      onClick={() => copyText(`${dm.opener}\n\n${dm.body}\n\n${dm.cta}`)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-white/[0.04] transition-all duration-150"
                      title="Copy all"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <span className="section-heading block mb-1">Opener</span>
                      <p className="text-xs text-text leading-relaxed">{dm.opener}</p>
                    </div>
                    <div>
                      <span className="section-heading block mb-1">Follow-up</span>
                      <p className="text-xs text-text leading-relaxed">{dm.body}</p>
                    </div>
                    <div>
                      <span className="section-heading block mb-1">CTA</span>
                      <p className="text-xs text-accent-blue leading-relaxed">{dm.cta}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AIPanel>
      )}

      <div>
        <p className="section-heading mb-5">Data Sources</p>
        <ConnectedSources sources={sources} onUpdate={setSources} />
      </div>

      <div>
        <p className="section-heading mb-5">Listening Feeds</p>
        <ListeningFeeds feeds={feeds} onUpdate={setFeeds} />
      </div>
    </div>
  );
}
