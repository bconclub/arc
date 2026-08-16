-- ARC Twin: the agent work queue, agent state, and post-level social metrics.
--
-- ARC is the system; Luko (and anything after it) is a stateless errand-runner. That
-- only holds if the queue, the cursors and the config live here rather than on the VPS
-- — otherwise rebuilding a container loses the work list and re-scans mail it already
-- processed. Workers claim jobs, report results, and hold nothing of their own.
--
-- Idempotent. Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ── Work queue ──────────────────────────────────────────────

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                    -- scan_mail | enrich_brand | collect_social | sweep_dates | ...
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  priority int not null default 100,     -- lower runs first
  run_at timestamptz not null default now(),
  claimed_by text,                       -- agent name, e.g. 'luko'
  claimed_at timestamptz,
  attempts int not null default 0,
  max_attempts int not null default 3,
  result jsonb,
  error text,
  -- optional dedupe handle: two jobs with the same key can't both sit queued
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_jobs_claim_idx
  on public.agent_jobs (status, run_at, priority);
create unique index if not exists agent_jobs_idem_key
  on public.agent_jobs (idempotency_key) where idempotency_key is not null and status in ('queued', 'running');

drop trigger if exists agent_jobs_set_updated_at on public.agent_jobs;
create trigger agent_jobs_set_updated_at
  before update on public.agent_jobs
  for each row execute function public.set_updated_at();

-- Claim one job atomically. Concurrent workers can't take the same row.
create or replace function public.claim_agent_job(worker text, kinds text[] default null)
returns setof public.agent_jobs as $$
  update public.agent_jobs j
     set status = 'running',
         claimed_by = worker,
         claimed_at = now(),
         attempts = j.attempts + 1
   where j.id = (
     select id from public.agent_jobs
      where status = 'queued'
        and run_at <= now()
        and (kinds is null or kind = any(kinds))
      order by priority, run_at
      limit 1
      for update skip locked
   )
  returning j.*;
$$ language sql;

-- ── Agent state: cursors, seen-ids, liveness ────────────────
-- Key/value per agent+scope. The Gmail historyId and processed message ids live here,
-- so a rebuilt container resumes instead of re-scanning (and re-inserting) the mailbox.

create table if not exists public.agent_state (
  id uuid primary key default gen_random_uuid(),
  agent text not null,                   -- 'luko'
  scope text not null,                   -- 'gmail:brands@bconclub.com', 'linkedin:org:123'
  cursor text,                           -- historyId / last post urn / etc
  seen jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (agent, scope)
);

create table if not exists public.agent_heartbeats (
  agent text primary key,
  last_seen timestamptz not null default now(),
  version text,
  note text,
  healthy boolean not null default true
);

-- A silent mail agent looks exactly like a quiet inbox. This is what tells them apart.
create or replace view public.agent_liveness as
  select agent, last_seen, healthy,
         extract(epoch from (now() - last_seen)) / 60 as minutes_since,
         (now() - last_seen) > interval '12 hours' as stale
    from public.agent_heartbeats;

-- ── Post-level social metrics ───────────────────────────────
-- brand_metrics already holds the per-platform daily snapshot (followers / reach /
-- engagement) and upserts on (platform, recorded_on) — that stays the account-level
-- series. Per-post numbers had nowhere to go; this is that place.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null
    check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin', 'x')),
  account text,                          -- org urn / handle — which account it posted from
  external_id text not null,             -- urn:li:share:… | tweet id | media id
  url text,
  posted_at timestamptz,
  text_preview text,
  -- raw platform payload, so a metric we don't model yet isn't lost
  metrics jsonb not null default '{}'::jsonb,
  impressions int,
  likes int,
  comments int,
  shares int,
  clicks int,
  engagement_rate numeric,
  -- ties a post back to the idea/plan that produced it, when known
  content_plan_id uuid references public.content_plan(id) on delete set null,
  collected_at timestamptz not null default now(),
  unique (platform, external_id)
);

create index if not exists social_posts_posted_idx on public.social_posts (posted_at desc);
create index if not exists social_posts_platform_idx on public.social_posts (platform);

-- ── RLS ─────────────────────────────────────────────────────

alter table public.agent_jobs       enable row level security;
alter table public.agent_state      enable row level security;
alter table public.agent_heartbeats enable row level security;
alter table public.social_posts     enable row level security;

drop policy if exists "Allow all agent_jobs" on public.agent_jobs;
create policy "Allow all agent_jobs" on public.agent_jobs for all using (true) with check (true);
drop policy if exists "Allow all social_posts" on public.social_posts;
create policy "Allow all social_posts" on public.social_posts for all using (true) with check (true);

-- agent_state and agent_heartbeats hold cursors and liveness, not display data —
-- service role only, no anon policy. RLS on with no policy = deny for anon.
