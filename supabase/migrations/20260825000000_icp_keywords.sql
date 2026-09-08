-- ICP keyword bank, 2026-08-25.
--
-- The phrases PROXe's buyers actually search and say. Rank is listen-rank
-- (ICP fit x specificity x how often the listening set is saying it), not
-- Google volume. A volume API is a later source, not a number we invent.
--
-- Seeded from src/lib/icp.ts on first read so the phrase list has one owner.

create table if not exists public.icp_keywords (
  id            uuid primary key default gen_random_uuid(),
  phrase        text not null,
  cluster       text not null check (cluster in ('pain', 'job', 'category', 'competitor', 'geo')),
  vertical      text not null check (vertical in ('clinic', 'coaching', 'real_estate', 'tutoring', 'founder', 'all')),
  intent        text not null check (intent in ('informational', 'commercial', 'transactional')),
  -- 0-100, recomputed on each listen. Never presented as search volume.
  rank_score    integer not null default 0,
  hits          integer not null default 0,
  source        text not null default 'seed' check (source in ('seed', 'harvest', 'manual')),
  status        text not null default 'use' check (status in ('use', 'watch', 'drop')),
  evidence      text not null default '',
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (phrase)
);

create index if not exists icp_keywords_rank_idx on public.icp_keywords (rank_score desc);
create index if not exists icp_keywords_vertical_idx on public.icp_keywords (vertical, cluster);

drop trigger if exists icp_keywords_set_updated_at on public.icp_keywords;
create trigger icp_keywords_set_updated_at
  before update on public.icp_keywords
  for each row execute function public.set_updated_at();

alter table public.icp_keywords enable row level security;

drop policy if exists icp_keywords_read on public.icp_keywords;
create policy icp_keywords_read on public.icp_keywords
  for select using (true);
