-- ============================================================
-- ARC — initial schema
-- Run once in Supabase SQL editor or via `supabase db push`
-- ============================================================

-- ── sources ─────────────────────────────────────────────────
create table if not exists public.sources (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('rss', 'tavily_search')),
  value      text not null,
  active     boolean not null default true,
  added_at   timestamptz not null default now()
);

-- ── signals ─────────────────────────────────────────────────
create table if not exists public.signals (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  url            text not null,
  snippet        text not null default '',
  source_name    text not null default '',
  image_url      text,
  published_date text not null default '',
  pillar         text check (pillar in ('pain_points', 'build_journey', 'marketing_tips', 'client_results')),
  trend_score    integer not null default 50,
  label          text not null default 'steady' check (label in ('hot', 'rising', 'steady')),
  saved          boolean not null default false,
  saved_at       timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.sources enable row level security;
alter table public.signals enable row level security;

-- Service role bypasses RLS automatically.
-- These policies allow the anon/authenticated key to read:
create policy "Allow read sources" on public.sources
  for select using (true);

create policy "Allow read signals" on public.signals
  for select using (true);

create policy "Allow update signals" on public.signals
  for update using (true);

-- ── default sources seed ────────────────────────────────────
insert into public.sources (name, type, value, active) values
  ('Inc42',          'rss',           'https://inc42.com/feed/',                          true),
  ('YourStory',      'rss',           'https://yourstory.com/feed',                       true),
  ('Neil Patel',     'rss',           'https://neilpatel.com/blog/feed/',                 true),
  ('Ben''s Bites',   'rss',           'https://www.bensbites.com/feed',                   true),
  ('Marketing Brew', 'rss',           'https://www.marketingbrew.com/feeds/newsletter',   true),
  ('WhatsApp India', 'tavily_search', 'WhatsApp business leads India 2026',               true),
  ('Meta Ads India', 'tavily_search', 'Meta ads small business India 2026',               true),
  ('AI Sales',       'tavily_search', 'AI follow-up sales automation India',              true)
on conflict do nothing;
