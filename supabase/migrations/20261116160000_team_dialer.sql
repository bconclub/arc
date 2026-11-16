-- Team dialer (16 Nov 2026): the sales team calls leads from a company Vobiz
-- number, never their own. A person dials their company number from their
-- registered mobile, enters a passcode, and stays on the line (a conference room
-- of their own). Each lead they tap in ARC is dialled from the company number
-- into that room. Every lead leg is recorded; the recording is copied to ARC's
-- private R2, transcribed, turned into a note and pushed to the lead in PROXe.
-- Idempotent. Server-only, like the other team tables.

-- Per person: the mobile Vobiz may accept a dial-in from, the passcode (PBKDF2,
-- same scheme as the login password) and the company number they call from.
alter table public.team_members add column if not exists dialer_phone text;
alter table public.team_members add column if not exists dialer_pin_hash text;
alter table public.team_members add column if not exists dialer_caller_id text;

-- One row per dial-in: the person's open line.
create table if not exists public.dialer_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members(id) on delete cascade,
  agent_call_uuid text not null,
  room text not null,
  status text not null default 'live' check (status in ('live', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index if not exists dialer_sessions_call on public.dialer_sessions (agent_call_uuid);
create index if not exists dialer_sessions_member on public.dialer_sessions (member_id, status, started_at desc);

-- One row per lead call (outbound from a session, or a lead calling a company number back).
create table if not exists public.dialer_calls (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.team_members(id) on delete set null,
  session_id uuid references public.dialer_sessions(id) on delete set null,
  target_id uuid references public.outreach_targets(id) on delete set null,
  proxe_lead_id uuid,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  phone text not null,
  caller_id text,
  request_uuid text,
  call_uuid text,
  status text not null default 'dialing'
    check (status in ('dialing', 'connected', 'ended', 'no_answer', 'failed')),
  hangup_cause text,
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_secs integer,
  -- Recording: Vobiz id + its (auth-only) URL, then our private copy in R2.
  recording_id text,
  recording_src text,
  recording_key text,
  recording_status text not null default 'pending'
    check (recording_status in ('pending', 'saved', 'missing', 'none')),
  transcript text,
  note text,
  fields jsonb,
  outcome text,
  processing_at timestamptz,
  processed_at timestamptz,
  proxe_synced_at timestamptz,
  proxe_error text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists dialer_calls_call_uuid on public.dialer_calls (call_uuid) where call_uuid is not null;
create index if not exists dialer_calls_member_time on public.dialer_calls (member_id, started_at desc);
create index if not exists dialer_calls_target on public.dialer_calls (target_id, started_at desc);
create index if not exists dialer_calls_unprocessed on public.dialer_calls (processed_at) where processed_at is null;
drop trigger if exists dialer_calls_set_updated_at on public.dialer_calls;
create trigger dialer_calls_set_updated_at before update on public.dialer_calls
  for each row execute function public.set_updated_at();

alter table public.dialer_sessions enable row level security;
alter table public.dialer_calls enable row level security;
revoke all on public.dialer_sessions, public.dialer_calls from anon, authenticated;
grant all on public.dialer_sessions, public.dialer_calls to service_role;
