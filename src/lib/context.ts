// Persistent context system for ARC AI calls
import { supabase } from "./supabase";

export type ContextKey = 
  | "voice_style" 
  | "about_me" 
  | "content_pillars" 
  | "sample_posts" 
  | "brain_system_prompt";

export interface ArcContext {
  voice_style: string;
  about_me: string;
  content_pillars: string;
  sample_posts: string;
  brain_system_prompt: string;
}

const DEFAULT_CONTEXT: ArcContext = {
  voice_style: `VOICE
- First person. lowercase. like texting a friend, not writing an ad.
- Vulnerable and honest. admit your own mistakes ("i forgot the follow-up too").
- Confident, not preachy. strong opinions, no lecturing.

STRUCTURE
- Open with a hook that names a problem people quietly accept.
- Short punchy sentences. one thought per line. heavy line breaks.
- Build: story, then the insight, then the shift, then the product/CTA.
- Use concrete details. real scenarios, specific numbers, named industries.

RULES
- No corporate fluff. no AI buzzwords (synergy, leverage, revolutionize, game-changer).
- Never use em dashes. ever.
- Don't oversell. let the story carry it.
- End every post with a CTA or an open question.

PRODUCT PUNCHLINE (keep consistent)
"PROXe turns every potential customer into revenue. Listens across every channel. Never forgets. Always improving."

RECURRING THEMES
- gaps quietly accepted as normal
- great product losing to faster response
- the AI-native moment (India, Kurzweil, the shift)
- build with AI, or let me build it for you`,
  about_me: "Thanzeel Ashruf (Z). Founder of PROXe (goproxe.com) and BCON Club (bconclub.com). 7 years in marketing across retail, services, hospitality, real estate, healthcare. We help businesses go AI-native in marketing: PROXe is enterprise-grade conversational AI for SMBs (listens across website, WhatsApp, Instagram, email, SMS, voice; warms leads, books calls, never forgets follow-up, founder dashboard); BCON Club helps businesses learn to build with AI. Running a 100-clients-in-90-days push. ICP: solo founders, coaching academies, clinics, real estate, tutoring centers in India losing leads to slow WhatsApp replies.",
  content_pillars: "Pain Points, Marketing Tips, Build Journey, Client Results",
  sample_posts: "",
  brain_system_prompt: "",
};

// Seed default context if table is empty
export async function seedDefaultContext(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("arc_context").select("key").limit(1);
  
  if (!data || data.length === 0) {
    const inserts = Object.entries(DEFAULT_CONTEXT).map(([key, value]) => ({
      key,
      value,
    }));
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("arc_context").insert(inserts);
  }
}

// Get single context value
export async function getContext(key: ContextKey): Promise<string> {
  await seedDefaultContext();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
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
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("arc_context")
    .select("key, value");
  
  if (error || !data) {
    return DEFAULT_CONTEXT;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = Object.fromEntries(data.map((r: any) => [r.key, r.value])) as ArcContext;
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
