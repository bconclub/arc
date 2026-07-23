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
