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

-- ── seed: default RSS sources (verified 200 OK + items; marketing/AI/business) ──
insert into public.sources (name, type, value, active) values
  -- India
  ('Inc42',                'rss', 'https://inc42.com/feed/',                                           true),
  ('ET BrandEquity',       'rss', 'https://brandequity.economictimes.indiatimes.com/rss/topstories',   true),
  ('YourStory Marketing',  'rss', 'https://yourstory.com/category/marketing/feed',                     true),
  -- Global marketing
  ('HubSpot Marketing',    'rss', 'https://blog.hubspot.com/marketing/rss.xml',                        true),
  ('Search Engine Land',   'rss', 'https://searchengineland.com/feed',                                 true),
  ('Search Engine Journal','rss', 'https://www.searchenginejournal.com/feed/',                         true),
  ('Neil Patel',           'rss', 'https://neilpatel.com/blog/feed/',                                  true),
  ('Seth Godin',           'rss', 'https://seths.blog/feed/',                                          true),
  ('Adweek',               'rss', 'https://www.adweek.com/feed/',                                      true),
  ('Buffer',               'rss', 'https://buffer.com/resources/rss/',                                 true),
  ('Marketing Week',       'rss', 'https://www.marketingweek.com/feed/',                               true),
  ('MarTech',              'rss', 'https://martech.org/feed/',                                         true),
  ('Social Media Today',   'rss', 'https://www.socialmediatoday.com/feeds/news/',                      true),
  -- AI / tech
  ('VentureBeat AI',       'rss', 'https://venturebeat.com/category/ai/feed',                          true),
  ('MIT Technology Review','rss', 'https://www.technologyreview.com/feed/',                            true),
  ('TechCrunch',           'rss', 'https://techcrunch.com/feed',                                       true),
  ('Hacker News',          'rss', 'https://hnrss.org/frontpage',                                       true)
on conflict do nothing;

-- ── seed: default context rows (plain text values) ───────────
insert into public.arc_context (key, value) values
  ('voice_style',         E'VOICE\n- First person. lowercase. like texting a friend, not writing an ad.\n- Vulnerable and honest. admit your own mistakes ("i forgot the follow-up too").\n- Confident, not preachy. strong opinions, no lecturing.\n\nSTRUCTURE\n- Open with a hook that names a problem people quietly accept.\n- Short punchy sentences. one thought per line. heavy line breaks.\n- Build: story, then the insight, then the shift, then the product/CTA.\n- Use concrete details. real scenarios, specific numbers, named industries.\n\nRULES\n- No corporate fluff. no AI buzzwords (synergy, leverage, revolutionize, game-changer).\n- Never use em dashes. ever.\n- Don''t oversell. let the story carry it.\n- End every post with a CTA or an open question.\n\nPRODUCT PUNCHLINE (keep consistent)\n"PROXe turns every potential customer into revenue. Listens across every channel. Never forgets. Always improving."\n\nRECURRING THEMES\n- gaps quietly accepted as normal\n- great product losing to faster response\n- the AI-native moment (India, Kurzweil, the shift)\n- build with AI, or let me build it for you'),
  ('about_me',            'Thanzeel Ashruf (Z). Founder of PROXe (goproxe.com) and BCON Club (bconclub.com). 7 years in marketing across retail, services, hospitality, real estate, healthcare. We help businesses go AI-native in marketing: PROXe is enterprise-grade conversational AI for SMBs (listens across website, WhatsApp, Instagram, email, SMS, voice; warms leads, books calls, never forgets follow-up, founder dashboard); BCON Club helps businesses learn to build with AI. Running a 100-clients-in-90-days push. ICP: solo founders, coaching academies, clinics, real estate, tutoring centers in India losing leads to slow WhatsApp replies.'),
  ('brain_system_prompt', ''),
  ('feed_topics',         '[{"label":"Marketing","query":"Marketing"},{"label":"AI","query":"AI"}]')
on conflict (key) do nothing;

-- Done. Verify:
--   select count(*) from public.sources;       -- expect 6
--   select tablename from pg_tables where schemaname='public' order by 1;
-- ARC Twin: Operations module (ported from LUKO) + Personal Brand module
-- Idempotent. Run in Supabase SQL editor (or via apply_all.sql).

create extension if not exists "pgcrypto";

-- ── Operations ──────────────────────────────────────────────

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  status text not null default 'active' check (status in ('active', 'waiting', 'parked', 'done')),
  next text,
  start_date date,
  end_date date,
  budget numeric,
  size text check (size in ('S', 'M', 'L', 'XL')),
  progress int not null default 0 check (progress between 0 and 100),
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  org text,
  relation text,
  channel text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  amount numeric,
  status text not null default 'draft' check (status in ('draft', 'sent', 'discussing', 'won', 'lost')),
  sent date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client text,
  item text,
  amount numeric,
  due date,
  status text not null default 'pending' check (status in ('pending', 'invoiced', 'overdue', 'paid')),
  created_at timestamptz not null default now()
);

-- named ops_signals: "signals" is already ARC's RSS feed cache
create table if not exists public.ops_signals (
  id uuid primary key default gen_random_uuid(),
  source text,
  title text not null,
  detail text,
  severity text not null default 'info' check (severity in ('info', 'warn', 'high', 'critical')),
  url text,
  seen boolean not null default false,
  ts timestamptz not null default now()
);

create table if not exists public.now_tasks (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  due date,
  created_at timestamptz not null default now()
);

-- ── Personal Brand ──────────────────────────────────────────

create table if not exists public.brand_metrics (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin', 'x')),
  recorded_on date not null default current_date,
  followers int,
  reach int,
  engagement numeric,
  notes text,
  created_at timestamptz not null default now(),
  unique (platform, recorded_on)
);

-- planning overlay; content source of truth stays in ideas/posts
create table if not exists public.content_plan (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin', 'x')),
  status text not null default 'idea' check (status in ('idea', 'draft', 'scheduled', 'posted')),
  planned_date date,
  idea_id bigint references public.ideas(id) on delete set null,
  post_id bigint references public.posts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── updated_at trigger ──────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists content_plan_set_updated_at on public.content_plan;
create trigger content_plan_set_updated_at
  before update on public.content_plan
  for each row execute function public.set_updated_at();

-- ── RLS (single-user tool → permissive; service role bypasses) ──

alter table public.projects      enable row level security;
alter table public.people        enable row level security;
alter table public.proposals     enable row level security;
alter table public.payments      enable row level security;
alter table public.ops_signals   enable row level security;
alter table public.now_tasks     enable row level security;
alter table public.brand_metrics enable row level security;
alter table public.content_plan  enable row level security;

drop policy if exists "Allow all projects"      on public.projects;
create policy "Allow all projects"      on public.projects      for all using (true) with check (true);
drop policy if exists "Allow all people"        on public.people;
create policy "Allow all people"        on public.people        for all using (true) with check (true);
drop policy if exists "Allow all proposals"     on public.proposals;
create policy "Allow all proposals"     on public.proposals     for all using (true) with check (true);
drop policy if exists "Allow all payments"      on public.payments;
create policy "Allow all payments"      on public.payments      for all using (true) with check (true);
drop policy if exists "Allow all ops_signals"   on public.ops_signals;
create policy "Allow all ops_signals"   on public.ops_signals   for all using (true) with check (true);
drop policy if exists "Allow all now_tasks"     on public.now_tasks;
create policy "Allow all now_tasks"     on public.now_tasks     for all using (true) with check (true);
drop policy if exists "Allow all brand_metrics" on public.brand_metrics;
create policy "Allow all brand_metrics" on public.brand_metrics for all using (true) with check (true);
drop policy if exists "Allow all content_plan"  on public.content_plan;
create policy "Allow all content_plan"  on public.content_plan  for all using (true) with check (true);

