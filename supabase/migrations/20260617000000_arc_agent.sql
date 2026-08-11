-- ARC Agent v0.1 schema
-- New tables only, does NOT touch existing sources / signals / arc_context / saved_signals

-- agent source registry (separate from the Next.js RSS sources table)
create table if not exists public.arc_sources (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('producthunt', 'reddit', 'youtube', 'x')),
  handle      text,         -- subreddit name, channel id, search query, etc.
  enabled     boolean default true,
  config      jsonb default '{}',
  created_at  timestamptz default now()
);

-- raw pulled trend items
create table if not exists public.trends (
  id          bigint generated always as identity primary key,
  source_id   bigint references public.arc_sources(id),
  external_id text not null,
  title       text not null,
  url         text,
  raw         jsonb,
  velocity    numeric default 0,   -- upvotes/hr, views/hr, etc.
  pulled_at   timestamptz default now(),
  unique (source_id, external_id)
);

-- evaluated + selected ideas
create table if not exists public.ideas (
  id          bigint generated always as identity primary key,
  trend_id    bigint references public.trends(id),
  fit_score   numeric,
  rationale   text,
  angle       text,
  status      text default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'done')),
  created_at  timestamptz default now()
);

-- generated scripts
create table if not exists public.scripts (
  id              bigint generated always as identity primary key,
  idea_id         bigint references public.ideas(id),
  hook            text,
  body            text,
  on_screen_text  jsonb,
  caption         text,
  hashtags        text[],
  shot_list       jsonb,
  created_at      timestamptz default now()
);

-- video assets (raw film or ai-generated)
create table if not exists public.assets (
  id            bigint generated always as identity primary key,
  script_id     bigint references public.scripts(id),
  kind          text check (kind in ('raw', 'edited')),
  storage_path  text,
  duration_s    numeric,
  created_at    timestamptz default now()
);

-- per-platform posts
create table if not exists public.posts (
  id                bigint generated always as identity primary key,
  asset_id          bigint references public.assets(id),
  platform          text not null check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin')),
  status            text default 'queued' check (status in ('queued', 'scheduled', 'published', 'failed')),
  external_post_id  text,
  scheduled_for     timestamptz,
  published_at      timestamptz,
  error             text
);

-- analytics per post
create table if not exists public.metrics (
  id          bigint generated always as identity primary key,
  post_id     bigint references public.posts(id),
  pulled_at   timestamptz default now(),
  views       int default 0,
  likes       int default 0,
  comments    int default 0,
  shares      int default 0,
  saves       int default 0,
  follows     int default 0,
  raw         jsonb
);

-- agent run log
create table if not exists public.runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz default now(),
  finished_at   timestamptz,
  stage         text,
  summary       jsonb,
  ok            boolean
);

-- RLS: service role bypasses; anon can read
alter table public.arc_sources  enable row level security;
alter table public.trends       enable row level security;
alter table public.ideas        enable row level security;
alter table public.scripts      enable row level security;
alter table public.assets       enable row level security;
alter table public.posts        enable row level security;
alter table public.metrics      enable row level security;
alter table public.runs         enable row level security;

create policy "read arc_sources"  on public.arc_sources  for select using (true);
create policy "read trends"       on public.trends        for select using (true);
create policy "read ideas"        on public.ideas         for select using (true);
create policy "update ideas"      on public.ideas         for update using (true);
create policy "read scripts"      on public.scripts       for select using (true);
create policy "read assets"       on public.assets        for select using (true);
create policy "read posts"        on public.posts         for select using (true);
create policy "read metrics"      on public.metrics       for select using (true);
create policy "read runs"         on public.runs          for select using (true);

-- seed sources
insert into public.arc_sources (kind, handle, enabled, config) values
  ('producthunt', null,          true,  '{"max_items": 20}'),
  ('reddit',      'marketing',   true,  '{"limit": 25, "sort": "hot"}'),
  ('reddit',      'entrepreneur',true,  '{"limit": 25, "sort": "hot"}'),
  ('reddit',      'startups',    true,  '{"limit": 20, "sort": "rising"}'),
  ('youtube',     'trending',    false, '{"region": "IN", "max_results": 20}'),
  ('x',           'AI tools',    false, '{"stub": true}')
on conflict do nothing;
