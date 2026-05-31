-- ============================================================
-- ARC — complete backend schema (idempotent, safe to re-run)
-- ------------------------------------------------------------
-- Paste this whole file into:  Supabase Dashboard → SQL Editor → Run
-- It creates every table the app reads/writes, fixes column gaps
-- between the code and the original migrations, applies permissive
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
  fetched_at     timestamptz,
  created_at     timestamptz not null default now()
);
-- columns the cache writer (cacheSignals) needs but the original migration lacked:
alter table public.signals add column if not exists source_type text default 'rss';
alter table public.signals add column if not exists favicon     text default '';

-- ── arc_context (voice / about / brain prompt / feed topics) ──
create table if not exists public.arc_context (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ── saved_signals (bookmarks) ────────────────────────────────
create table if not exists public.saved_signals (
  id            uuid primary key default gen_random_uuid(),
  saved_at      timestamptz not null default now(),
  title         text not null,
  url           text not null unique,
  source        text not null default '',
  source_type   text not null default 'rss',
  created_at    timestamptz not null default now()
);
-- columns the save-signal endpoint writes but the original migration lacked:
alter table public.saved_signals add column if not exists published_at timestamptz;
alter table public.saved_signals add column if not exists score        integer default 0;
alter table public.saved_signals add column if not exists excerpt      text default '';
alter table public.saved_signals add column if not exists favicon_url  text default '';

-- ── voice_templates (was never migrated) ─────────────────────
create table if not exists public.voice_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  pattern     text not null default '',
  example     text not null default '',
  created_at  timestamptz not null default now()
);

-- ── RLS (single-user tool → permissive; service role bypasses) ──
alter table public.sources         enable row level security;
alter table public.signals         enable row level security;
alter table public.arc_context     enable row level security;
alter table public.saved_signals   enable row level security;
alter table public.voice_templates enable row level security;

-- sources: the Sources page reads AND writes via the anon key, so allow all.
drop policy if exists "Allow read sources" on public.sources;
drop policy if exists "Allow all sources"  on public.sources;
create policy "Allow all sources" on public.sources for all using (true) with check (true);

drop policy if exists "Allow read signals"   on public.signals;
drop policy if exists "Allow update signals" on public.signals;
drop policy if exists "Allow all signals"    on public.signals;
create policy "Allow all signals" on public.signals for all using (true) with check (true);

drop policy if exists "Allow all arc_context" on public.arc_context;
create policy "Allow all arc_context" on public.arc_context for all using (true) with check (true);

drop policy if exists "Allow all saved_signals" on public.saved_signals;
create policy "Allow all saved_signals" on public.saved_signals for all using (true) with check (true);

drop policy if exists "Allow all voice_templates" on public.voice_templates;
create policy "Allow all voice_templates" on public.voice_templates for all using (true) with check (true);

-- ── seed: default RSS sources (zero tokens, zero credits) ─────
insert into public.sources (name, type, value, active) values
  ('Inc42',          'rss', 'https://inc42.com/feed/',                          true),
  ('YourStory',      'rss', 'https://yourstory.com/feed',                       true),
  ('TechCrunch',     'rss', 'https://techcrunch.com/feed',                      true),
  ('Neil Patel',     'rss', 'https://neilpatel.com/blog/feed/',                 true),
  ('Marketing Brew', 'rss', 'https://www.marketingbrew.com/feeds/newsletter',   true),
  ('Hacker News',    'rss', 'https://hnrss.org/frontpage',                      true),
  ('Product Hunt',   'rss', 'https://www.producthunt.com/feed',                 true)
on conflict do nothing;

-- ── seed: default context rows ───────────────────────────────
insert into public.arc_context (key, value) values
  ('voice_style',         '""'::jsonb),
  ('about_me',            '""'::jsonb),
  ('brain_system_prompt', '""'::jsonb),
  ('feed_topics',         '[]'::jsonb)
on conflict (key) do nothing;

-- Done. Verify:
--   select count(*) from public.sources;   -- expect 7
