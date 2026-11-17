-- Team dialer, 17 Nov 2026: the call guide (questions to get answered on a call)
-- and, per call, which of them the transcript shows were answered. Idempotent.
alter table public.dialer_calls add column if not exists checklist jsonb;

create table if not exists public.dialer_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.dialer_settings enable row level security;
revoke all on public.dialer_settings from anon, authenticated;
grant all on public.dialer_settings to service_role;
