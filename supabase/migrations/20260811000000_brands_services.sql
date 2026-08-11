-- ARC v2 dashboard. ADDITIVE ONLY. Safe to re-run.
--
-- IMPORTANT naming note. This database already has two tables whose names look
-- like what a dashboard would want, but mean something else entirely:
--
--   public.brands   → the CLIENT REGISTER (GSTIN, aliases, domains, revenue).
--                     This IS the right table for brand rollups, so we reuse it
--                     and only ADD presentation columns. Nothing is redefined.
--
--   public.services → the GST SERVICE CATALOGUE (SAC codes, tax rates, price
--                     bands). NOT infrastructure. Never write uptime rows here.
--
-- Infrastructure/connector health therefore lives in its own table,
-- public.system_health, to avoid clobbering billing data.

create extension if not exists "pgcrypto";

-- ── Presentation columns on the existing client register ────
-- Purely additive: no type changes, no constraints on existing columns, so the
-- GST/billing fields and their data are untouched.

alter table public.brands add column if not exists logo_url     text;
alter table public.brands add column if not exists color        text;   -- hex accent; falls back to a hashed colour
alter table public.brands add column if not exists github_repos text[]; -- owner/repo slugs for the activity panel

create index if not exists brands_name_idx on public.brands (name);

-- Link the brands that have repos. Matched case-insensitively against the
-- names already in the table; adds nothing and creates no rows.
update public.brands set github_repos = array['bconclub/proxe', 'bconclub/goproxe.com', 'bconclub/proxe-issues']
  where lower(name) = 'proxe' and (github_repos is null or cardinality(github_repos) = 0);
update public.brands set github_repos = array['bconclub/windchasers']
  where lower(name) = 'windchasers' and (github_repos is null or cardinality(github_repos) = 0);
update public.brands set github_repos = array['bconclub/ouch']
  where lower(name) like 'ouch%' and (github_repos is null or cardinality(github_repos) = 0);
update public.brands set github_repos = array['bconclub/laptopstore']
  where lower(name) = 'laptop store india' and (github_repos is null or cardinality(github_repos) = 0);
update public.brands set github_repos = array['bconclub/maison-isivis']
  where lower(name) = 'isivis group' and (github_repos is null or cardinality(github_repos) = 0);
update public.brands set github_repos = array['bconclub/jamaican-kitchen']
  where lower(name) = 'jamaican kitchen' and (github_repos is null or cardinality(github_repos) = 0);

-- ── Infrastructure health (Operations Health panel) ─────────
-- Distinct name so it can never be confused with the billing `services` table.

create table if not exists public.system_health (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- GitHub, Vercel, Supabase, Anthropic…
  category text,                      -- Repos, Deployments, Database, AI API…
  status text not null default 'healthy' check (status in ('healthy', 'issue', 'paused', 'failed', 'down')),
  detail text,
  url text,
  last_checked timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_health enable row level security;
drop policy if exists "Allow all system_health" on public.system_health;
create policy "Allow all system_health" on public.system_health for all using (true) with check (true);

-- Seeded from the connector registry; /api/ops/connectors?probe=1 keeps them current.
insert into public.system_health (name, category, status) values
  ('GitHub',     'Repos',       'paused'),
  ('Anthropic',  'AI API',      'paused'),
  ('Supabase',   'Database',    'paused'),
  ('Vercel',     'Deployments', 'paused'),
  ('OpenRouter', 'AI API',      'paused'),
  ('Tavily',     'Research',    'paused'),
  ('WhatsApp',   'Messaging',   'paused'),
  ('Gmail',      'Email',       'paused'),
  ('Pabbly',     'Workflows',   'paused')
on conflict (name) do nothing;

-- ── Task estimates (Focus For Today durations) ──────────────

alter table public.now_tasks add column if not exists estimate_minutes int;
alter table public.now_tasks add column if not exists priority text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'now_tasks_priority_check') then
    alter table public.now_tasks
      add constraint now_tasks_priority_check
      check (priority is null or priority in ('low', 'medium', 'high'));
  end if;
end $$;
