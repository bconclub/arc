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
