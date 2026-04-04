import { createClient } from "@supabase/supabase-js";

// Singleton pattern to prevent multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createClient> | null = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Client-side (browser safe) - use for reads in client components
export function getSupabase() {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase env vars missing - client will not work");
    }
    supabaseInstance = createClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseAnonKey || "placeholder"
    );
  }
  return supabaseInstance;
}

export const supabase = getSupabase();

// Server-side only (API routes, server components)
// Use this for writes, seeding, admin ops - NEVER import in client components
export const supabaseAdmin = typeof window === "undefined"
  ? createClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseServiceKey || "placeholder"
    )
  : supabase;

// Types for Supabase tables
export type Source = {
  id: string;
  name: string;
  type: "rss" | "tavily_search";
  value: string;
  active: boolean;
  added_at: string;
};

export type Signal = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source_name: string;
  image_url?: string;
  published_date: string;
  pillar?: string;
  trend_score: number;
  label: "hot" | "rising" | "steady";
  saved: boolean;
  saved_at?: string;
  notes?: string;
  created_at: string;
};
