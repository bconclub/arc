-- ============================================================
-- ARC — complete backend schema (idempotent, safe to re-run)
-- ------------------------------------------------------------
-- Run AFTER 01_drop_old_tables.sql (or on a fresh ARC project).
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- Creates every table the app reads/writes, applies permissive
-- single-user RLS, and seeds default sources + context.
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

-- ── signals (feed cache) ─────────────────────────────────────
create table if not exists public.signals (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  url            text not null unique,
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
  source_type    text default 'rss',
  favicon        text default '',
  fetched_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- ── arc_context (voice / about / brain prompt / feed topics) ──
-- value is TEXT to match the app (lib/context.ts writes plain strings;
-- route.ts stores feed_topics as a JSON string too).
create table if not exists public.arc_context (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

-- ── saved_signals (bookmarks) ────────────────────────────────
create table if not exists public.saved_signals (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  url           text not null unique,
  source        text not null default '',
  source_type   text not null default 'rss',
  published_at  timestamptz,
  score         integer default 0,
  excerpt       text default '',
  favicon_url   text default '',
  created_at    timestamptz not null default now()
);

-- ── voice_templates (extracted writing patterns) ─────────────
create table if not exists public.voice_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  pattern     text not null default '',
  example     text not null default '',
  created_at  timestamptz not null default now()
);

-- ── inspiration_posts (raw posts you save to extract voice from) ─
create table if not exists public.inspiration_posts (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  source      text not null default 'LinkedIn',
  added_at    timestamptz not null default now()
);

-- ── RLS (single-user tool → permissive; service role bypasses) ──
alter table public.sources           enable row level security;
alter table public.signals           enable row level security;
alter table public.arc_context       enable row level security;
alter table public.saved_signals     enable row level security;
alter table public.voice_templates   enable row level security;
alter table public.inspiration_posts enable row level security;

drop policy if exists "Allow all sources"           on public.sources;
create policy "Allow all sources"           on public.sources           for all using (true) with check (true);
drop policy if exists "Allow all signals"           on public.signals;
create policy "Allow all signals"           on public.signals           for all using (true) with check (true);
drop policy if exists "Allow all arc_context"       on public.arc_context;
create policy "Allow all arc_context"       on public.arc_context       for all using (true) with check (true);
drop policy if exists "Allow all saved_signals"     on public.saved_signals;
create policy "Allow all saved_signals"     on public.saved_signals     for all using (true) with check (true);
drop policy if exists "Allow all voice_templates"   on public.voice_templates;
create policy "Allow all voice_templates"   on public.voice_templates   for all using (true) with check (true);
drop policy if exists "Allow all inspiration_posts" on public.inspiration_posts;
create policy "Allow all inspiration_posts" on public.inspiration_posts for all using (true) with check (true);

-- ── seed: default RSS sources (bot-accessible, 200 OK) ────────
insert into public.sources (name, type, value, active) values
  ('Inc42',             'rss', 'https://inc42.com/feed/',                    true),
  ('TechCrunch',        'rss', 'https://techcrunch.com/feed',                true),
  ('Neil Patel',        'rss', 'https://neilpatel.com/blog/feed/',           true),
  ('HubSpot Marketing', 'rss', 'https://blog.hubspot.com/marketing/rss.xml', true),
  ('Hacker News',       'rss', 'https://hnrss.org/frontpage',                true),
  ('Smashing Magazine', 'rss', 'https://www.smashingmagazine.com/feed/',     true)
on conflict do nothing;

-- ── seed: default context rows (plain text values) ───────────
insert into public.arc_context (key, value) values
  ('voice_style',         'Raw, vulnerable, build-in-public, first person. Short punchy sentences. No corporate fluff. Conversational like texting a friend. Every post ends with a CTA.'),
  ('about_me',            'Thanzeel (Z), founder of PROXe and BCON Club. Solo builder running a 100-clients-in-90-days push. ICP: solo founders, coaching academies, clinics, real estate, tutoring centers in India losing leads to slow WhatsApp replies.'),
  ('brain_system_prompt', ''),
  ('feed_topics',         '[{"label":"Marketing","query":"marketing trends India SMB 2026"},{"label":"AI Tools","query":"AI tools business automation 2026"}]')
on conflict (key) do nothing;

-- Done. Verify:
--   select count(*) from public.sources;       -- expect 6
--   select tablename from pg_tables where schemaname='public' order by 1;
