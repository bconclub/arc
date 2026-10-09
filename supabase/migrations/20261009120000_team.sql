-- Team logins: people who work inside ARC with their own account (sales first).
-- One row per person; the owner adds them and sets passwords from /dashboard/team.
-- Leads get an owner, the owner gives people tasks, and each person has an
-- "Ask" thread with the PROXe assistant. Idempotent.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null,
  password_hash text not null,          -- PBKDF2 "salt:hash", same scheme as the owner password
  role text not null default 'sales' check (role in ('sales')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists team_members_username on public.team_members (lower(username));
drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

-- Who works a lead. Null = unassigned (the founder's).
alter table public.outreach_targets add column if not exists owner_id uuid references public.team_members(id) on delete set null;
create index if not exists outreach_targets_owner on public.outreach_targets (owner_id);
-- Inbound leads mirrored from PROXe (source 'proxe_inbound'): PROXe's stage, score,
-- channel and brand as of the last sync. ARC's own status stays the working stage.
alter table public.outreach_targets add column if not exists inbound jsonb;
create unique index if not exists outreach_targets_proxe_lead on public.outreach_targets (proxe_lead_id) where proxe_lead_id is not null;

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members(id) on delete cascade,
  title text not null,
  details text,
  due_on date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  target_id uuid references public.outreach_targets(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_tasks_member on public.team_tasks (member_id, status);
drop trigger if exists team_tasks_set_updated_at on public.team_tasks;
create trigger team_tasks_set_updated_at before update on public.team_tasks
  for each row execute function public.set_updated_at();

create table if not exists public.team_chat (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists team_chat_member on public.team_chat (member_id, created_at);

-- Server-only, like the rest of the outreach tables.
alter table public.team_members enable row level security;
alter table public.team_tasks enable row level security;
alter table public.team_chat enable row level security;
revoke all on public.team_members, public.team_tasks, public.team_chat from anon, authenticated;
grant all on public.team_members, public.team_tasks, public.team_chat to service_role;
