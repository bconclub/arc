-- ============================================================
-- ARC, arc_context table (key-value store for app settings)
-- Run after 20260405000000_init.sql
-- ============================================================

create table if not exists public.arc_context (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.arc_context enable row level security;

create policy "Allow read arc_context" on public.arc_context
  for select using (true);

create policy "Allow upsert arc_context" on public.arc_context
  for all using (true);

-- Seed default feed topics
insert into public.arc_context (key, value) values (
  'feed_topics',
  '[
    {"label": "WhatsApp India",  "query": "WhatsApp business leads India 2026"},
    {"label": "Meta Ads India",  "query": "Meta ads small business India 2026"},
    {"label": "AI Sales",        "query": "AI follow-up sales automation India"},
    {"label": "Founder Growth",  "query": "founder growth marketing tactics 2026"},
    {"label": "AI Tools",        "query": "AI tools founder productivity 2026"}
  ]'::jsonb
) on conflict do nothing;
