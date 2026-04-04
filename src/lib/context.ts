// Persistent context system for ARC AI calls
import { supabase } from "./supabase";
import type { AIModel } from "./ai-client";

export type ContextKey = 
  | "voice_style" 
  | "about_me" 
  | "content_pillars" 
  | "sample_posts" 
  | "brain_system_prompt"
  | "preferred_model";

export interface ArcContext {
  voice_style: string;
  about_me: string;
  content_pillars: string;
  sample_posts: string;
  brain_system_prompt: string;
  preferred_model: AIModel;
}

const DEFAULT_CONTEXT: ArcContext = {
  voice_style: "Raw, vulnerable, build-in-public, first person. Short punchy sentences. No corporate fluff. Conversational like texting a friend. Every post ends with CTA like DM me DEMO or Comment LEADS.",
  about_me: "Thanzeel (Z), founder of PROXe and BCON Club. Sole builder, salesperson, operator. Running 100 clients in 90 days push. ICP: solo founders, coaching academies, clinics, real estate agents, tutoring centers in India. They lose leads due to slow WhatsApp replies.",
  content_pillars: "Pain Points, Marketing Tips, Build Journey, Client Results",
  sample_posts: "",
  brain_system_prompt: "",
  preferred_model: "claude",
};

// Seed default context if table is empty
export async function seedDefaultContext(): Promise<void> {
  const { data } = await supabase.from("arc_context").select("key").limit(1);
  
  if (!data || data.length === 0) {
    const inserts = Object.entries(DEFAULT_CONTEXT).map(([key, value]) => ({
      key,
      value,
    }));
    
    await supabase.from("arc_context").insert(inserts);
  }
}

// Get single context value
export async function getContext(key: ContextKey): Promise<string> {
  await seedDefaultContext();
  
  const { data, error } = await supabase
    .from("arc_context")
    .select("value")
    .eq("key", key)
    .single();
  
  if (error || !data) {
    return DEFAULT_CONTEXT[key];
  }
  
  return data.value;
}

// Set single context value
export async function setContext(key: ContextKey, value: string): Promise<void> {
  const { error } = await supabase
    .from("arc_context")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  
  if (error) {
    console.error("Error setting context:", error);
    throw error;
  }
}

// Get full context object
export async function getFullContext(): Promise<ArcContext> {
  await seedDefaultContext();
  
  const { data, error } = await supabase
    .from("arc_context")
    .select("key, value");
  
  if (error || !data) {
    return DEFAULT_CONTEXT;
  }
  
  const ctx = Object.fromEntries(data.map(r => [r.key, r.value])) as ArcContext;
  return { ...DEFAULT_CONTEXT, ...ctx };
}

// Build system prompt from context
export function buildSystemPrompt(ctx: Partial<ArcContext>): string {
  const merged = { ...DEFAULT_CONTEXT, ...ctx };
  
  return `
You are a content writing assistant for ${merged.about_me}

Voice style: ${merged.voice_style}

Content pillars: ${merged.content_pillars}

Sample posts for reference:
${merged.sample_posts || "Not set yet"}

${merged.brain_system_prompt ? "Additional voice instructions: " + merged.brain_system_prompt : ""}

RULES:
- Write in first person (I, me, my)
- Never corporate speak
- Short punchy sentences
- End every post with a specific CTA (DM me, Comment below, etc.)
- No fluff, no motivational quotes, no generic advice
- Write like you're texting a friend who happens to be a founder
`.trim();
}

// Generate brain system prompt from inputs
export async function generateBrainPrompt(inputs: {
  voice_style: string;
  about_me: string;
  sample_posts: string;
}): Promise<string> {
  return `Write as ${inputs.about_me.split(".")[0]}. Voice: ${inputs.voice_style.split(".").slice(0, 2).join(".")}. ${inputs.sample_posts ? "Match the energy of provided samples." : ""} Always end with action-oriented CTA.`;
}
