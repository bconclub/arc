"use client";

import { useState } from "react";
import { Linkedin, Instagram, MessageCircle, AtSign, Eye, MessageSquare, Send, Repeat } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { ScheduledPost, PostResult } from "@/types/content-engine";

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  LinkedIn: <Linkedin size={14} />,
  Instagram: <Instagram size={14} />,
  WhatsApp: <MessageCircle size={14} />,
  Twitter: <AtSign size={14} />,
  X: <AtSign size={14} />,
};

export default function ResultsPage() {
  const [schedule] = useLocalStorage<ScheduledPost[]>("arc:schedule", []);
  const [results, setResults] = useLocalStorage<PostResult[]>("arc:results", []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ views: 0, comments: 0, replies: 0, dms: 0 });

  // Get done posts that don't have results yet
  const donePosts = schedule.filter(p => p.status === "done");
  
  // Merge with existing results
  const postsWithResults = donePosts.map(post => {
    const result = results.find(r => r.id === post.id);
    return { post, result };
  });

  const handleEdit = (postId: string, result?: PostResult) => {
    setEditingId(postId);
    setEditForm({
      views: result?.views || 0,
      comments: result?.comments || 0,
      replies: result?.replies || 0,
      dms: result?.dms || 0,
    });
  };

  const handleSave = (postId: string) => {
    const post = schedule.find(p => p.id === postId);
    if (!post) return;

    const newResult: PostResult = {
      id: postId,
      topic: post.topic,
      channel: post.channel,
      date: post.date,
      pillar: post.pillar || "Build Journey",
      ...editForm,
    };

    setResults(prev => {
      const existing = prev.findIndex(r => r.id === postId);
      if (existing >= 0) {
        return prev.map(r => r.id === postId ? newResult : r);
      }
      return [...prev, newResult];
    });
    setEditingId(null);
  };

  const handleRepost = (post: ScheduledPost) => {
    // Create a new scheduled post with same topic
    const newPost: ScheduledPost = {
      id: `post-${Date.now()}`,
      topic: `${post.topic} (repost)`,
      channel: post.channel,
      date: new Date().toISOString().split("T")[0],
      time: "09:00",
      status: "scheduled",
      draft: post.draft,
      pillar: post.pillar,
    };
    
    const existing = JSON.parse(localStorage.getItem("arc:schedule") || "[]");
    localStorage.setItem("arc:schedule", JSON.stringify([...existing, newPost]));
    window.location.href = "/dashboard/schedule";
  };

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Results</h1>
        <p className="text-[13px] text-text-muted mt-0.5">What landed</p>
      </div>

      {/* Posts list */}
      <div className="space-y-3">
        {postsWithResults.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-text-muted mb-1">No completed posts yet</p>
            <p className="text-xs text-text-muted/60">Mark posts as done in Schedule to track results</p>
          </div>
        ) : (
          postsWithResults.map(({ post, result }) => (
            <div key={post.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text-muted">{CHANNEL_ICONS[post.channel] || <AtSign size={14} />}</span>
                    <span className="text-[11px] text-text-muted">{post.channel} · {post.date}</span>
                  </div>
                  <p className="text-[14px] font-medium text-text truncate">{post.topic}</p>
                </div>
                <button
                  onClick={() => handleRepost(post)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] text-text-muted hover:text-text bg-surface hover:bg-white/[0.08] rounded-lg transition-all"
                >
                  <Repeat size={11} />
                  Post again
                </button>
              </div>

              {/* Stats */}
              {editingId === post.id ? (
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[
                    { key: "views", icon: Eye, label: "Views" },
                    { key: "comments", icon: MessageSquare, label: "Comments" },
                    { key: "replies", icon: Send, label: "Replies" },
                    { key: "dms", icon: MessageCircle, label: "DMs" },
                  ].map(({ key, icon: Icon, label }) => (
                    <div key={key} className="text-center">
                      <Icon size={12} className="mx-auto mb-1 text-text-muted" />
                      <input
                        type="number"
                        value={editForm[key as keyof typeof editForm]}
                        onChange={(e) => setEditForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-bg border border-white/[0.08] rounded-lg px-2 py-1.5 text-[13px] text-text text-center focus:border-white/20 focus:outline-none"
                      />
                      <span className="text-[9px] text-text-muted uppercase tracking-wider">{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[
                    { key: "views", icon: Eye, label: "Views", val: result?.views || 0 },
                    { key: "comments", icon: MessageSquare, label: "Comments", val: result?.comments || 0 },
                    { key: "replies", icon: Send, label: "Replies", val: result?.replies || 0 },
                    { key: "dms", icon: MessageCircle, label: "DMs", val: result?.dms || 0 },
                  ].map(({ key, icon: Icon, label, val }) => (
                    <div key={key} className="text-center">
                      <Icon size={12} className="mx-auto mb-1 text-text-muted" />
                      <span className="text-[15px] font-semibold text-text block">{val}</span>
                      <span className="text-[9px] text-text-muted uppercase tracking-wider">{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit/Save button */}
              <div className="flex justify-end mt-3">
                {editingId === post.id ? (
                  <button
                    onClick={() => handleSave(post.id)}
                    className="px-3 py-1.5 text-[12px] font-medium bg-white text-black rounded-lg hover:bg-white/90"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => handleEdit(post.id, result)}
                    className="px-3 py-1.5 text-[12px] text-text-muted hover:text-text transition-colors"
                  >
                    {result ? "Edit stats" : "Add stats"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
