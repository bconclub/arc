import { createClient } from "@supabase/supabase-js";

// Client-side (browser safe) - use for reads in client components
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side only (API routes, server components)
// Use this for writes, seeding, admin ops - NEVER import in client components
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
