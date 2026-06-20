-- Create the 3 content-engine tables missing from this project
-- (voice_templates, inspiration_posts, saved_signals). Idempotent + RLS.
-- Run in Supabase Dashboard → SQL Editor. Does NOT touch sources/signals.

create table if not exists public.voice_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  pattern     text not null default '',
  example     text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.inspiration_posts (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  source      text not null default 'LinkedIn',
  added_at    timestamptz not null default now()
);

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

alter table public.voice_templates   enable row level security;
alter table public.inspiration_posts enable row level security;
alter table public.saved_signals     enable row level security;

drop policy if exists "Allow all voice_templates"   on public.voice_templates;
create policy "Allow all voice_templates"   on public.voice_templates   for all using (true) with check (true);
drop policy if exists "Allow all inspiration_posts" on public.inspiration_posts;
create policy "Allow all inspiration_posts" on public.inspiration_posts for all using (true) with check (true);
drop policy if exists "Allow all saved_signals"     on public.saved_signals;
create policy "Allow all saved_signals"     on public.saved_signals     for all using (true) with check (true);
