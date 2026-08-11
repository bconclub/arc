"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, Newspaper, Search, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Source {
  id: string;
  name: string;
  type: "rss" | "tavily_search";
  value: string;
  active: boolean;
  added_at: string;
}

// Default RSS sources to seed if no RSS sources exist.
// Curated to be bot-accessible (200 OK) and relevant to the India SMB / founder / marketing ICP.
const DEFAULT_RSS_SOURCES: Omit<Source, "id" | "added_at">[] = [
  // India
  { name: "Inc42", type: "rss", value: "https://inc42.com/feed/", active: true },
  { name: "ET BrandEquity", type: "rss", value: "https://brandequity.economictimes.indiatimes.com/rss/topstories", active: true },
  { name: "YourStory Marketing", type: "rss", value: "https://yourstory.com/category/marketing/feed", active: true },
  // Global marketing
  { name: "HubSpot Marketing", type: "rss", value: "https://blog.hubspot.com/marketing/rss.xml", active: true },
  { name: "Search Engine Land", type: "rss", value: "https://searchengineland.com/feed", active: true },
  { name: "Search Engine Journal", type: "rss", value: "https://www.searchenginejournal.com/feed/", active: true },
  { name: "Neil Patel", type: "rss", value: "https://neilpatel.com/blog/feed/", active: true },
  { name: "Seth Godin", type: "rss", value: "https://seths.blog/feed/", active: true },
  { name: "Adweek", type: "rss", value: "https://www.adweek.com/feed/", active: true },
  { name: "Buffer", type: "rss", value: "https://buffer.com/resources/rss/", active: true },
  { name: "Marketing Week", type: "rss", value: "https://www.marketingweek.com/feed/", active: true },
  { name: "MarTech", type: "rss", value: "https://martech.org/feed/", active: true },
  { name: "Social Media Today", type: "rss", value: "https://www.socialmediatoday.com/feeds/news/", active: true },
  // AI / tech
  { name: "VentureBeat AI", type: "rss", value: "https://venturebeat.com/category/ai/feed", active: true },
  { name: "MIT Technology Review", type: "rss", value: "https://www.technologyreview.com/feed/", active: true },
  { name: "TechCrunch", type: "rss", value: "https://techcrunch.com/feed", active: true },
  { name: "Hacker News", type: "rss", value: "https://hnrss.org/frontpage", active: true },
];

const TYPE_OPTIONS: { value: "rss" | "tavily_search"; label: string; placeholder: string }[] = [
  { value: "rss", label: "RSS Feed", placeholder: "https://example.com/feed.xml" },
  { value: "tavily_search", label: "Tavily Search", placeholder: "Enter search query..." },
];

export default function SourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState({
    name: "",
    type: "rss" as "rss" | "tavily_search",
    value: "",
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("sources")
        .select("*")
        .order("added_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching sources:", error);
      } else {
        const rows = (data || []) as Source[];
        // Self-heal: seed default RSS sources if none exist (covers a table that
        // only ever had search sources, or where RSS feeds were all deleted).
        const hasRss = rows.some((s) => s.type === "rss");
        if (!hasRss) {
          await seedDefaultSources();
        } else {
          setSources(rows);
        }
      }
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const seedDefaultSources = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("sources")
        .insert(DEFAULT_RSS_SOURCES);
      
      if (error) {
        console.error("Error seeding default sources:", error);
      } else {
        // Fetch again after seeding
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("sources")
          .select("*")
          .order("added_at", { ascending: false });
        setSources(data || []);
      }
    } catch (err) {
      console.error("Error seeding:", err);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("sources")
        .update({ active: !currentActive })
        .eq("id", id);
      
      if (error) {
        console.error("Error toggling source:", error);
      } else {
        setSources(sources.map(s => s.id === id ? { ...s, active: !currentActive } : s));
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("sources")
        .delete()
        .eq("id", id);
      
      if (error) {
        console.error("Error deleting source:", error);
      } else {
        setSources(sources.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleAdd = async () => {
    if (!newSource.name || !newSource.value) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("sources")
        .insert({
          name: newSource.name,
          type: newSource.type,
          value: newSource.value,
          active: true,
        });
      
      if (error) {
        console.error("Error adding source:", error);
      } else {
        setShowAddModal(false);
        setNewSource({ name: "", type: "rss", value: "" });
        fetchSources();
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleRefreshFeed = () => {
    setRefreshing(true);
    router.push("/dashboard/feed?refresh=true");
  };

  const activeCount = sources.filter(s => s.active).length;

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sources</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {activeCount} active · {sources.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshFeed}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-hover rounded-full transition-all"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh Feed
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-black bg-white hover:bg-white/90 rounded-full transition-all"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.06] rounded w-1/3" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className={`card p-4 flex items-center justify-between gap-4 ${!source.active ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-muted shrink-0">
                  {source.type === "rss" ? <Newspaper size={18} /> : <Search size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-text truncate">{source.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted shrink-0">
                      {source.type === "rss" ? "RSS" : "Search"}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-muted truncate">{source.value}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(source.id, source.active)}
                  className={`p-2 rounded-lg transition-all ${source.active ? "text-accent-green" : "text-text-muted"}`}
                  title={source.active ? "Active" : "Inactive"}
                >
                  {source.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => handleDelete(source.id)}
                  className="p-2 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {sources.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-sm text-text-muted mb-4">No sources yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-[12px] font-medium bg-white text-black rounded-lg hover:bg-white/90"
              >
                Add your first source
              </button>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-backdrop">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-md card p-5 animate-modal">
            <h3 className="text-[16px] font-semibold text-text mb-4">Add Source</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setNewSource({ ...newSource, type: opt.value })}
                      className={`flex items-center gap-2 p-3 rounded-xl text-[13px] transition-all ${
                        newSource.type === opt.value
                          ? "bg-white text-black"
                          : "bg-surface text-text-muted hover:text-text"
                      }`}
                    >
                      {opt.value === "rss" ? <Newspaper size={16} /> : <Search size={16} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="e.g. TechCrunch"
                  className="w-full bg-bg border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5">
                  Value
                </label>
                <input
                  type="text"
                  value={newSource.value}
                  onChange={(e) => setNewSource({ ...newSource, value: e.target.value })}
                  placeholder={TYPE_OPTIONS.find(o => o.value === newSource.type)?.placeholder}
                  className="w-full bg-bg border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none"
                />
                <p className="text-[11px] text-text-muted/60 mt-1.5">
                  {newSource.type === "rss" && "Full RSS feed URL"}
                  {newSource.type === "tavily_search" && "Search query for trending topics"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleAdd}
                disabled={!newSource.name || !newSource.value}
                className="flex-1 py-2.5 bg-white text-black text-[13px] font-medium rounded-xl hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                Add Source
              </button>
              <button
                onClick={() => setShowAddModal(false)}
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
