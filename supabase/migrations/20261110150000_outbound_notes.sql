-- The one shared log for the AI callers: what Z said about a call (feedback), what the
-- calls themselves teach (learning), every change made to a caller (change) and what is
-- still broken (issue). Agents post to /api/agent/outreach/notes; people read and add on
-- /dashboard/outreach/callers. Idempotent.

create table if not exists public.outbound_notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('feedback', 'learning', 'change', 'issue')),
  caller text,                            -- which AI caller: Intro Cold, Intro DM, Follow-up; null = all
  body text not null,
  action text,                            -- what it turns into: the rule, the fix, the backup location
  author text not null default 'Z',       -- who said or did it: Z, GOD, PROXe Core, a team login
  call_id text,                           -- the call it came from, when there is one
  noted_on date not null default current_date,
  resolved_at timestamptz,                -- issues only: when it was fixed
  source text not null default 'arc',     -- 'arc' = typed on the page; otherwise the agent that posted it
  external_id text,                       -- set by agents, for upserts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists outbound_notes_external on public.outbound_notes (source, external_id);
create index if not exists outbound_notes_kind on public.outbound_notes (kind, noted_on desc);
drop trigger if exists outbound_notes_set_updated_at on public.outbound_notes;
create trigger outbound_notes_set_updated_at before update on public.outbound_notes
  for each row execute function public.set_updated_at();

alter table public.outbound_notes enable row level security;
revoke all on public.outbound_notes from anon, authenticated;
grant all on public.outbound_notes to service_role;
