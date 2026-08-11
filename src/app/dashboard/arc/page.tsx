"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, TrendingUp, RefreshCw, PenLine, Sparkles } from "lucide-react";

interface Trend {
  id: number;
  title: string;
  url: string;
  velocity: number;
  raw: Record<string, unknown>;
  pulled_at: string;
}

interface Idea {
  id: number;
  trend_id: number;
  fit_score: number;
  rationale: string;
  angle: string;
  status: "proposed" | "approved" | "rejected";
  created_at: string;
  trends: Trend;
}

interface Run {
  id: number;
  stage: string;
  ok: boolean | null;
  started_at: string;
  finished_at: string | null;
  summary: Record<string, unknown>;
}

export default function ARCPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [ideasRes, runsRes] = await Promise.all([
      fetch("/api/arc/ideas"),
      fetch("/api/arc/runs"),
    ]);
    const ideasData = await ideasRes.json();
    const runsData = await runsRes.json();
    setIdeas(ideasData.ideas || []);
    setRuns(runsData.runs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/arc/ideas/generate", { method: "POST" });
      await load();
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  // Send an idea straight into the Write engine, pre-loaded with the angle.
  const write = useCallback((idea: Idea) => {
    const topic = idea.trends?.title || idea.angle || "";
    const srcTitle = (idea.trends?.raw as Record<string, unknown>)?.source_title as string | undefined;
    const context = [idea.angle, idea.rationale, srcTitle ? `Source: ${srcTitle}` : ""].filter(Boolean).join("\n\n");
    router.push(`/dashboard/write?topic=${encodeURIComponent(topic)}&context=${encodeURIComponent(context)}`);
  }, [router]);

  const action = async (id: number, status: "approved" | "rejected") => {
    setActioning(id);
    await fetch("/api/arc/ideas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    setActioning(null);
  };

  const proposed = ideas.filter(i => i.status === "proposed");
  const approved = ideas.filter(i => i.status === "approved");

  return (
    <div className="page space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ARC Agent</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {proposed.length} awaiting review · {approved.length} approved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={generating || loading}
            className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium bg-text text-bg hover:opacity-90 rounded-full transition-all disabled:opacity-50"
          >
            <Sparkles size={14} className={generating ? "animate-pulse" : ""} />
            {generating ? "Generating..." : "Generate Top Ideas"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-hover rounded-full transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Proposed ideas */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-3">
          Proposed Ideas ({proposed.length})
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : proposed.length === 0 ? (
          <div className="card p-8 text-center text-text-muted text-[13px]">
            No ideas yet. Click <span className="text-text font-medium">Generate Top Ideas</span> to pull the best from your feed.
          </div>
        ) : (
          <div className="space-y-3">
            {proposed.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                actioning={actioning === idea.id}
                onWrite={() => write(idea)}
                onApprove={() => action(idea.id, "approved")}
                onReject={() => action(idea.id, "rejected")}
              />
            ))}
          </div>
        )}
      </section>

      {/* Approved */}
      {approved.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-3">
            Approved and in pipeline ({approved.length})
          </h2>
          <div className="space-y-3">
            {approved.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                actioning={false}
                approved
                onWrite={() => write(idea)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent runs */}
      {runs.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-3">
            Recent Runs
          </h2>
          <div className="space-y-2">
            {runs.map(run => (
              <div key={run.id} className="card p-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    run.ok === true ? "bg-accent-green" :
                    run.ok === false ? "bg-accent-red" :
                    "bg-yellow-500"
                  }`} />
                  <span className="text-[13px] font-medium text-text">{run.stage}</span>
                  <span className="text-[11px] text-text-muted truncate">
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                </div>
                {run.ok === null && (
                  <span className="text-[10px] text-yellow-400 shrink-0">running</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  actioning,
  approved,
  onWrite,
  onApprove,
  onReject,
}: {
  idea: Idea;
  actioning: boolean;
  approved?: boolean;
  onWrite?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const score = idea.fit_score;
  const scoreColor =
    score >= 70 ? "text-accent-green" :
    score >= 50 ? "text-yellow-400" :
    "text-text-muted";

  const source = (idea.trends?.raw as Record<string, unknown>)?.source || "unknown";
  const velocity = idea.trends?.velocity || 0;

  return (
    <div className="card p-4 space-y-3">
      {/* Title + score */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            href={idea.trends?.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] font-medium text-text hover:text-white line-clamp-2 transition-colors"
          >
            {idea.trends?.title || "Untitled trend"}
          </a>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-text-muted capitalize">{String(source)}</span>
            {velocity > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-text-muted">
                <TrendingUp size={11} />
                {velocity.toFixed(1)}/hr
              </span>
            )}
          </div>
        </div>
        <div className={`text-[22px] font-bold tabular-nums shrink-0 ${scoreColor}`}>
          {score.toFixed(0)}
        </div>
      </div>

      {/* Rationale */}
      <p className="text-[12px] text-text-muted leading-relaxed">{idea.rationale}</p>

      {/* Angle */}
      <div className="bg-surface rounded-xl px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Angle: </span>
        <span className="text-[13px] text-text">{idea.angle}</span>
      </div>

      {/* Actions */}
      {!approved && (
        <div className="flex gap-2 pt-1">
          {onWrite && (
            <button
              onClick={onWrite}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium bg-text text-bg hover:opacity-90 rounded-full transition-all"
            >
              <PenLine size={14} />
              Write this
            </button>
          )}
          {onApprove && (
            <button
              onClick={onApprove}
              disabled={actioning}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium bg-accent-green/10 text-accent-green hover:bg-accent-green/20 rounded-full transition-all disabled:opacity-50"
            >
              <CheckCircle size={14} />
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              disabled={actioning}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium bg-surface text-text-muted hover:text-text hover:bg-surface-hover rounded-full transition-all disabled:opacity-50"
            >
              <XCircle size={14} />
              Reject
            </button>
          )}
        </div>
      )}

      {approved && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-accent-green">
            <CheckCircle size={12} />
            Approved
          </div>
          {onWrite && (
            <button
              onClick={onWrite}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium bg-text text-bg hover:opacity-90 rounded-full transition-all"
            >
              <PenLine size={14} />
              Write this
            </button>
          )}
        </div>
      )}
    </div>
  );
}
