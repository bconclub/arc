-- Brand Reels: the team drops an Instagram link in ARC, the Mac editor worker
-- downloads it, breaks the style down, recreates it for the brand, uploads the
-- cut here (Storage) and to Drive, and the reel waits in review until approved
-- or sent back with notes (which queues the next version).
--
-- The work itself runs as agent_jobs rows of kind 'brand_reel' (payload:
-- { reel_id, version }), claimed through /api/agent/next like every other worker.
-- RLS on, no policies: only the service role (ARC's API routes) touches these.

create table if not exists public.brand_reels (
  id               uuid primary key default gen_random_uuid(),
  ig_url           text not null,
  brand            text not null default 'BCON',
  note             text,                      -- the team's brief when queueing
  title            text,                      -- set by the worker once it knows the format
  status           text not null default 'queued'
    check (status in ('queued', 'processing', 'review', 'changes', 'approved', 'failed', 'cancelled')),
  stage            text,                      -- download | breakdown | assets | motion | edit | upload
  progress         int not null default 0,    -- 0..100
  version          int not null default 1,    -- bumps on every "request changes"
  feedback         text,                      -- notes for the version being made now
  ref              jsonb not null default '{}'::jsonb,  -- { handle, caption, duration, kind, breakdown, sheet }
  outputs          jsonb not null default '[]'::jsonb,  -- [{ version, kind, name, path, size, duration, drive_url }]
  drive_folder_url text,
  job_id           uuid,
  worker           text,
  error            text,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists brand_reels_created_idx on public.brand_reels (created_at desc);

drop trigger if exists brand_reels_set_updated_at on public.brand_reels;
create trigger brand_reels_set_updated_at
  before update on public.brand_reels
  for each row execute function public.set_updated_at();

create table if not exists public.brand_reel_events (
  id         bigserial primary key,
  reel_id    uuid not null references public.brand_reels (id) on delete cascade,
  at         timestamptz not null default now(),
  kind       text not null,                   -- created | stage | output | review | approved | changes | failed | retry
  note       text,
  actor      text                             -- 'team' or the worker name
);

create index if not exists brand_reel_events_reel_idx on public.brand_reel_events (reel_id, at desc);

alter table public.brand_reels enable row level security;
alter table public.brand_reel_events enable row level security;

-- Private bucket. The browser gets short-lived signed URLs from ARC; the worker
-- gets signed upload URLs, so the Mac never holds the service role key.
insert into storage.buckets (id, name, public)
values ('brand-reels', 'brand-reels', false)
on conflict (id) do nothing;

-- Library: a reel that has been posted is 'live', with the post link. `code` is the
-- short production id (T7, BR-12) the team uses when talking about a reel.
alter table public.brand_reels drop constraint if exists brand_reels_status_check;
alter table public.brand_reels add constraint brand_reels_status_check
  check (status in ('queued', 'processing', 'review', 'changes', 'approved', 'live', 'failed', 'cancelled'));
alter table public.brand_reels add column if not exists posted_url text;
alter table public.brand_reels add column if not exists posted_at timestamptz;
alter table public.brand_reels add column if not exists code text;
