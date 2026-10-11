-- GTM, rebuilt as plans: one plan per distribution channel (research, landing
-- page and trial emails, outbound, content, UGC, SEO, ads), each judged on
-- signups and sales, never views. The brief and the approval rules live in
-- arc_context ('gtm_brief'). The old gtm_areas checklist is kept, unused.
-- Idempotent; seeds only missing plans.

create table if not exists public.gtm_plans (
  slug text primary key,
  name text not null,
  ord int not null default 0,
  phase text not null default 'later',      -- week1 | week2 | week3 | later
  status text not null default 'not_started' check (status in ('not_started', 'building', 'live', 'paused')),
  why text not null default '',             -- what this plan is for, in one or two lines
  metric text not null default '',          -- the one number it is judged on (signups, demos, sales)
  target text not null default '',
  current text not null default '',
  cadence text not null default '',         -- e.g. weekly, daily 09:30
  owner text not null default '',
  steps jsonb not null default '[]',        -- [{ text, done }]
  tools text[] not null default '{}',
  guardrails text[] not null default '{}',
  next_action text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);
drop trigger if exists gtm_plans_set_updated_at on public.gtm_plans;
create trigger gtm_plans_set_updated_at before update on public.gtm_plans
  for each row execute function public.set_updated_at();
alter table public.gtm_plans enable row level security;
revoke all on public.gtm_plans from anon, authenticated;
grant all on public.gtm_plans to service_role;
