"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Trash2, Lightbulb, FileText, Wand2 } from "lucide-react";
import { getFullContext, setContext } from "@/lib/context";
import { useAI } from "@/hooks/useAI";
import { supabase } from "@/lib/supabase";

interface InspirationPost {
  id: string;
  content: string;
  source: string;
  added_at: string;
}

interface VoiceTemplate {
  id: string;
  name: string;
  pattern: string;
  example: string;
  created_at: string;
}

export default function VoicePage() {
  // Core context fields
  const [aboutMe, setAboutMe] = useState("");
  const [voiceStyle, setVoiceStyle] = useState("");
  const [brainPrompt, setBrainPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Inspiration posts
  const [inspirationPosts, setInspirationPosts] = useState<InspirationPost[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostSource, setNewPostSource] = useState<"LinkedIn" | "Twitter" | "Other">("LinkedIn");
  const [addingPost, setAddingPost] = useState(false);

  // Voice templates
  const [templates, setTemplates] = useState<VoiceTemplate[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const generateAI = useAI<{ prompt: string }>();
  const analyzeAI = useAI<{ templates: VoiceTemplate[] }>();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Load context
    const ctx = await getFullContext();
    setAboutMe(ctx.about_me);
    setVoiceStyle(ctx.voice_style);
    setBrainPrompt(ctx.brain_system_prompt);

    // Load inspiration posts
    await loadInspirationPosts();

    // Load templates
    await loadTemplates();
    
    setLoading(false);
  };

  const loadInspirationPosts = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("inspiration_posts")
        .select("*")
        .order("added_at", { ascending: false });
      
      if (!error && data) {
        setInspirationPosts(data);
      }
    } catch (err) {
      console.error("Error loading inspiration posts:", err);
    }
  };

  const loadTemplates = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("voice_templates")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setTemplates(data);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    }
  };

  const handleSaveAboutMe = async () => {
    setSaving(true);
    await setContext("about_me", aboutMe);
    setSaving(false);
  };

  const handleSaveVoiceStyle = async () => {
    setSaving(true);
    await setContext("voice_style", voiceStyle);
    setSaving(false);
  };

  const handleAddPost = async () => {
    if (!newPostContent.trim()) return;
    if (inspirationPosts.length >= 10) {
      alert("Maximum 10 posts allowed. Delete one first.");
      return;
    }

    setAddingPost(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("inspiration_posts")
        .insert({
          content: newPostContent.trim(),
          source: newPostSource,
        });

      if (error) {
        console.error("Error adding post:", error);
      } else {
        setNewPostContent("");
        await loadInspirationPosts();
      }
    } catch (err) {
      console.error("Error:", err);
    }
    setAddingPost(false);
  };

  const handleDeletePost = async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("inspiration_posts")
        .delete()
        .eq("id", id);

      if (!error) {
        setInspirationPosts(posts => posts.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleAnalyzeVoice = async () => {
    if (inspirationPosts.length === 0) {
      alert("Add some inspiration posts first.");
      return;
    }

    setAnalyzing(true);
    await analyzeAI.trigger(
      "analyze-voice",
      {
        posts: inspirationPosts,
        voice_style: voiceStyle,
      },
      false
    );
    setAnalyzing(false);
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (analyzeAI.data && (analyzeAI.data as any).templates) {
      // Templates were saved to DB by the API, just reload
      loadTemplates();
    }
  }, [analyzeAI.data]);

  const handleRegenerateBrainPrompt = async () => {
    setRegenerating(true);
    await generateAI.trigger(
      "generate-brain-prompt",
      {
        voice_style: voiceStyle,
        about_me: aboutMe,
        templates: templates,
      },
      false
    );
    setRegenerating(false);
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = generateAI.data as any;
    if (data?.prompt) {
      setBrainPrompt(data.prompt);
      setContext("brain_system_prompt", data.prompt);
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
            Define your style and capture inspiration
          </p>
        </div>
        {saving && (
          <span className="text-[11px] text-text-muted">Saving...</span>
        )}
      </div>

      {/* About Me */}
      <div className="card p-4 mb-4">
        <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
          About Me
        </label>
        <textarea
          value={aboutMe}
          onChange={(e) => setAboutMe(e.target.value)}
          onBlur={handleSaveAboutMe}
          placeholder="Who are you? What's your story?"
          className="w-full min-h-[100px] bg-bg border border-white/[0.08] rounded-xl p-3 text-[13px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none resize-none"
        />
      </div>

      {/* Voice Style */}
      <div className="card p-4 mb-6">
        <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
          Voice Style
        </label>
        <textarea
          value={voiceStyle}
          onChange={(e) => setVoiceStyle(e.target.value)}
          onBlur={handleSaveVoiceStyle}
          placeholder="How do you write? Raw, vulnerable, direct?"
          className="w-full min-h-[100px] bg-bg border border-white/[0.08] rounded-xl p-3 text-[13px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none resize-none"
        />
      </div>

      {/* Inspiration Posts Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-text-muted" />
          <h2 className="text-[15px] font-medium">Inspiration Posts</h2>
          <span className="text-[11px] text-text-muted/60">
            {inspirationPosts.length}/10
          </span>
        </div>

        {/* Add Post */}
        <div className="card p-4 mb-4">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="Paste a LinkedIn or Twitter post you liked..."
            className="w-full min-h-[100px] bg-bg border border-white/[0.08] rounded-xl p-3 text-[13px] text-text placeholder:text-text-muted/40 focus:border-white/20 focus:outline-none resize-none mb-3"
          />
          
          <div className="flex items-center justify-between">
            {/* Source Selector */}
            <div className="flex items-center gap-1 bg-surface rounded-lg p-1">
              {(["LinkedIn", "Twitter", "Other"] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => setNewPostSource(source)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                    newPostSource === source
                      ? "bg-white text-black"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>

            <button
              onClick={handleAddPost}
              disabled={!newPostContent.trim() || addingPost || inspirationPosts.length >= 10}
              className="px-4 py-2 text-[12px] font-medium bg-white text-black rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {addingPost ? "Adding..." : "Add post"}
            </button>
          </div>
        </div>

        {/* Saved Posts */}
        {inspirationPosts.length > 0 && (
          <div className="space-y-3">
            {inspirationPosts.map((post) => (
              <div key={post.id} className="card p-4 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted">
                    {post.source}
                  </span>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-[12px] text-text-muted line-clamp-4 whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analyze Voice Button */}
      <button
        onClick={handleAnalyzeVoice}
        disabled={analyzing || inspirationPosts.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black text-[14px] font-medium rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all mb-8"
      >
        {analyzing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Wand2 size={16} />
        )}
        {analyzing ? "Analyzing..." : "Analyse my voice"}
      </button>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-text-muted" />
            <h2 className="text-[15px] font-medium">Writing Templates</h2>
          </div>

          <div className="grid gap-3">
            {templates.map((template) => (
              <div key={template.id} className="card p-4">
                <h3 className="text-[13px] font-medium text-text mb-1">
                  {template.name}
                </h3>
                <p className="text-[11px] text-text-muted mb-3">
                  {template.pattern}
                </p>
                <p className="text-[11px] text-text-muted/60 italic line-clamp-3">
                  &ldquo;{template.example}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regenerate Brain Prompt Button */}
      <button
        onClick={handleRegenerateBrainPrompt}
        disabled={regenerating}
        className="w-full flex items-center justify-center gap-2 py-3 bg-surface hover:bg-surface-hover text-text text-[14px] font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all mb-6"
      >
        {regenerating ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {regenerating ? "Generating..." : "Regenerate brain prompt"}
      </button>

      {/* Generated Brain Prompt */}
      {brainPrompt && (
        <div className="card p-4">
          <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-3">
            Brain Prompt
          </label>
          <div className="bg-surface rounded-xl p-4 text-[12px] text-text-muted leading-relaxed whitespace-pre-wrap">
            {brainPrompt}
          </div>
          <p className="text-[11px] text-text-muted/60 mt-3">
            Used in every AI call. Update your voice settings and regenerate to change it.
          </p>
        </div>
      )}
    </div>
  );
}
