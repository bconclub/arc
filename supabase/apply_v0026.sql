
-- ============================================================
-- 20260724000000_project_kind_payment_type.sql
-- ============================================================
-- ARC Twin: project type (one-time vs ongoing) + payment type & deal balance
-- Idempotent. Run in Supabase SQL editor.

alter table public.projects
  add column if not exists kind text not null default 'one-time'
    check (kind in ('one-time', 'ongoing'));

alter table public.payments
  add column if not exists payment_type text
    check (payment_type in ('full', 'advance', 'partial')),
  -- total value of the deal this payment is against; lets us compute the
  -- outstanding balance for advance / partial payments. null = not tracked.
  add column if not exists deal_total numeric;

-- ============================================================
-- 20260725000000_gtm_knowledge.sql
-- ============================================================
-- ARC Twin: GTM grounding knowledge base.
-- The 16 top-level go-to-market areas the system should always be grounded on.
-- Each area = what it is (guidance) + where we stand (our content) + status.
-- ARC/Supabase is master; a script mirrors these to an Obsidian vault.
-- Idempotent. Run in Supabase SQL editor.

create table if not exists public.gtm_areas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  ord int not null default 0,
  what text,                    -- what this area is (pre-filled guidance)
  stand text,                   -- where we stand: our current state (we fill)
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'defined', 'validated')),
  updated_at timestamptz not null default now()
);

drop trigger if exists gtm_areas_set_updated_at on public.gtm_areas;
create trigger gtm_areas_set_updated_at
  before update on public.gtm_areas
  for each row execute function public.set_updated_at();

alter table public.gtm_areas enable row level security;
drop policy if exists "Allow all gtm_areas" on public.gtm_areas;
create policy "Allow all gtm_areas" on public.gtm_areas for all using (true) with check (true);

insert into public.gtm_areas (slug, title, ord, what) values
  ('foundation',         'Foundation',         1,  'Who we serve and why we exist: market definition, ICP, buyer personas, jobs-to-be-done, TAM/SAM/SOM.'),
  ('positioning',        'Positioning',        2,  'How we are seen vs alternatives: value prop, differentiation, category design, competitive positioning, the positioning statement.'),
  ('messaging',          'Messaging',          3,  'What we say and how: core narrative, messaging framework, taglines, objection handling, message testing.'),
  ('pricing',            'Pricing',            4,  'How we package and charge: pricing research, tiers, pricing metrics, discount policy, the pricing page.'),
  ('channels',           'Channels',           5,  'Where we reach buyers: channel strategy, inbound, outbound, partnerships, channel testing.'),
  ('sales_motion',       'Sales Motion',       6,  'How deals get done: self-serve, sales-led, product-led, sales playbook, demo scripts.'),
  ('content_engine',     'Content Engine',     7,  'What we publish to pull demand: content strategy, SEO content, case studies, lead magnets, sales enablement.'),
  ('launch_plan',        'Launch Plan',        8,  'How we ship to market: launch tiers, timeline, press & PR, launch assets, internal alignment.'),
  ('demand_generation',  'Demand Generation',  9,  'How we create pipeline: paid ads, email campaigns, webinars, events, social selling, ABM.'),
  ('pipeline',           'Pipeline',           10, 'How leads move: lead scoring, routing, qualification framework, CRM setup, pipeline reviews.'),
  ('conversion',         'Conversion',         11, 'How we close: trial optimization, sales process, proposal templates, negotiation, closing playbook.'),
  ('customer_success',   'Customer Success',   12, 'How we retain and grow: onboarding flow, success milestones, QBRs, renewal strategy, advocacy.'),
  ('metrics',            'Metrics',            13, 'How we measure: CAC & LTV, funnel metrics, attribution, GTM dashboard, win/loss analysis.'),
  ('expansion_revenue',  'Expansion Revenue',  14, 'How we grow accounts: upsell plays, cross-sell, seat expansion, usage expansion, enterprise motion.'),
  ('optimization',       'Optimization',       15, 'How we improve: A/B testing, funnel fixes, message iteration, doubling down, kill list.'),
  ('scale',              'Scale',              16, 'How we expand the machine: new segments, new geographies, GTM hiring, RevOps, repeatable playbooks.')
on conflict (slug) do nothing;

-- ============================================================
-- 20260726000000_project_links_schedule.sql
-- ============================================================
-- ARC Twin: richer projects — links, walkthrough notes, reusable category,
-- and a malleable per-project payment schedule.
-- Idempotent. Run in Supabase SQL editor.

alter table public.projects
  add column if not exists category text,             -- reusable keyword (e.g. "Website Redesign")
  add column if not exists notes text,                -- walkthrough / what we're building
  add column if not exists links jsonb not null default '[]'::jsonb,            -- [{label,url}]
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb; -- [{label,amount,due,paid}]

-- ============================================================
-- 20260727000000_gtm_items.sql
-- ============================================================
-- ARC Twin: per-area GTM sub-items with their own status.
-- Each GTM area (Foundation, Positioning, …) breaks into concrete sub-items
-- (Market Definition, ICP, …), each tracked not_started → in_progress →
-- defined → validated. Stored as jsonb [{name, status}]; the item NAMES are
-- the fixed taxonomy (client-side), the DB persists each item's status.
-- Idempotent. Run in Supabase SQL editor.

alter table public.gtm_areas
  add column if not exists items jsonb not null default '[]'::jsonb;

-- ============================================================
-- 20260727000001_proxe_signals.sql
-- ============================================================
-- PROXe wing: signals coming FROM the PROXe product into ARC (the fortress frontend).
-- Daily briefs + pattern extraction land here; ARC's /dashboard/proxe renders them.
-- Issues/updates reuse the same table via `kind` so one wing shows all PROXe signal.

create table if not exists public.arc_briefs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'brief',      -- brief | issue | update
  brand       text not null,                       -- bcon | windchasers | lokazen | pop | proxe
  brief_date  date not null,                       -- the day the signal covers
  title       text not null,
  body_md     text not null default '',            -- the model's markdown (patterns, etc.)
  totals      jsonb not null default '{}'::jsonb,   -- {new_leads, conversations, ...}
  source      text default 'daily-brief',
  created_at  timestamptz not null default now(),
  -- one brief per brand per day per kind; re-runs upsert instead of duplicating
  unique (kind, brand, brief_date)
);

create index if not exists arc_briefs_date_idx on public.arc_briefs (brief_date desc);
create index if not exists arc_briefs_brand_idx on public.arc_briefs (brand);

-- RLS: ARC reads via anon (dashboard is password-gated at the app layer), writes via
-- service role only (the ingest API + generator). Enable RLS, allow anon SELECT,
-- block anon writes (service role bypasses RLS).
alter table public.arc_briefs enable row level security;

drop policy if exists arc_briefs_read on public.arc_briefs;
create policy arc_briefs_read on public.arc_briefs
  for select using (true);

-- ============================================================
-- 20260815000000_services_tax_port.sql
-- ============================================================
-- Port of the local-machine services + Indian tax work onto the origin/main schema.
--
-- The original 20260728000000_brands_services_tax.sql also created a `brands` table
-- with jsonb aliases/domains. origin/main's 20260811 series owns the brands schema
-- (aliases/domains as text[]), so every brands DDL statement is deliberately absent
-- here. Only the service catalogue, the brand/service FK wiring, and the payments
-- tax split are ported.
--
-- Idempotent. Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ── Service catalogue ───────────────────────────────────────
-- Price bands derived from seven years of actual receipts, so adding a project can
-- pre-fill a realistic amount instead of a blank box.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases jsonb not null default '[]'::jsonb,
  scope_md text,                                  -- what this service actually includes
  sac_code text,                                  -- SAC for GST invoicing — CA to confirm
  default_gst_rate numeric not null default 18,
  median_amount numeric,
  p25_amount numeric,
  p75_amount numeric,
  txns int not null default 0,
  lifetime_revenue numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Wire the existing tables to brands and services ─────────
-- people.brand_id already exists via 20260811010000; the guard makes this a no-op there.

alter table public.projects
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null;

alter table public.proposals
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null;

alter table public.people
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

alter table public.ops_signals
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists projects_brand_idx    on public.projects (brand_id);
create index if not exists proposals_brand_idx   on public.proposals (brand_id);
create index if not exists people_brand_idx      on public.people (brand_id);
create index if not exists ops_signals_brand_idx on public.ops_signals (brand_id);

-- ── Money: links, Indian FY, and the tax split ──────────────

alter table public.payments
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null,

  -- Indian financial year, Apr–Mar, stored as '2025-26'. Derived on write; kept as a
  -- column so every report is FY-native instead of re-deriving from dates each time.
  add column if not exists fy text,
  add column if not exists received_on date,
  add column if not exists stage text
    check (stage in ('advance', 'partial', 'balance', 'due', 'full')),

  -- invoice side (the tax point) — null on historical rows, which is the point:
  -- an unreconciled receipt is a visible worklist item, not a silent gap
  add column if not exists invoice_no text,
  add column if not exists invoice_date date,
  add column if not exists sac_code text,
  add column if not exists taxable_value numeric,
  add column if not exists gst_rate numeric,
  add column if not exists cgst numeric,
  add column if not exists sgst numeric,
  add column if not exists igst numeric,
  add column if not exists total_invoiced numeric,

  -- deduction side: clients deduct TDS (commonly 194J on professional services), so
  -- what lands is less than what was billed. Without this the books under-state income
  -- and the TDS credit is lost at reconciliation against 26AS / AIS.
  add column if not exists tds_section text,
  add column if not exists tds_amount numeric,
  add column if not exists net_received numeric,

  add column if not exists currency text not null default 'INR',
  add column if not exists reconciled boolean not null default false,
  add column if not exists source text,
  -- provenance for agent-ingested rows; the unique index below is what stops a
  -- re-scanned mailbox from duplicating invoices
  add column if not exists source_message_id text;

create unique index if not exists payments_source_message_id_key
  on public.payments (source_message_id) where source_message_id is not null;

create index if not exists payments_brand_idx   on public.payments (brand_id);
create index if not exists payments_project_idx on public.payments (project_id);
create index if not exists payments_fy_idx      on public.payments (fy);
create index if not exists payments_recon_idx   on public.payments (reconciled) where reconciled = false;

-- ── FY helper ───────────────────────────────────────────────

create or replace function public.indian_fy(d date)
returns text as $$
  select case when d is null then null
    when extract(month from d) >= 4
      then extract(year from d)::int || '-' || right((extract(year from d)::int + 1)::text, 2)
      else (extract(year from d)::int - 1) || '-' || right(extract(year from d)::text, 2)
  end;
$$ language sql immutable;

create or replace function public.payments_set_fy()
returns trigger as $$
begin
  if new.received_on is not null then
    new.fy = public.indian_fy(new.received_on);
  elsif new.invoice_date is not null then
    new.fy = public.indian_fy(new.invoice_date);
  elsif new.due is not null then
    new.fy = public.indian_fy(new.due);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists payments_fy_trigger on public.payments;
create trigger payments_fy_trigger
  before insert or update on public.payments
  for each row execute function public.payments_set_fy();

-- ── Rollup: brand revenue, FY-native ────────────────────────

create or replace view public.brand_fy_revenue as
  select b.id as brand_id, b.name, p.fy,
         count(*) as txns,
         sum(coalesce(p.net_received, p.amount, 0)) as received,
         sum(coalesce(p.total_invoiced, 0)) as invoiced,
         sum(coalesce(p.tds_amount, 0)) as tds,
         count(*) filter (where p.reconciled = false) as unreconciled
  from public.brands b
  join public.payments p on p.brand_id = b.id
  group by b.id, b.name, p.fy;

-- ── RLS ─────────────────────────────────────────────────────

alter table public.services enable row level security;

drop policy if exists "Allow all services" on public.services;
create policy "Allow all services" on public.services for all using (true) with check (true);

-- ============================================================
-- 20260815000001_agent_queue_social.sql
-- ============================================================
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

-- ============================================================
-- 20260816000000_chat_events_brandfk.sql
-- ============================================================
-- Ops Chat, the update-intent ledger, first-class ops history, and the
-- brand_id backfill that makes free-text `client` a display column rather
-- than the join key.
--
-- The FK columns themselves come from 20260815000000_services_tax_port.sql;
-- this migration fills them from the alias registry and adds what the chat
-- layer and the invoice parser need to persist.
--
-- Idempotent. Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ── Parser fields the accept path was dropping ──────────────
-- taxable_value / cgst / sgst / igst exist for the CA-grade split; tax_amount
-- is the parser's undivided figure, kept as stated on the document rather
-- than guessed into a split that may be wrong.

alter table public.payments
  add column if not exists tax_amount numeric,
  add column if not exists gstin text;

alter table public.email_ingest
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists email_ingest_brand_idx on public.email_ingest (brand_id);

-- ── Backfill brand_id from the alias registry ───────────────
-- Matching normalises against name + aliases, the same rule rollup.ts uses.
-- Only null rows are touched, so re-running never overwrites a manual link.

update public.projects p
   set brand_id = b.id
  from public.brands b
 where p.brand_id is null
   and p.client is not null
   and (lower(trim(p.client)) = lower(b.name)
        or lower(trim(p.client)) in (select lower(a) from unnest(coalesce(b.aliases, '{}'::text[])) a));

update public.proposals pr
   set brand_id = b.id
  from public.brands b
 where pr.brand_id is null
   and pr.client is not null
   and (lower(trim(pr.client)) = lower(b.name)
        or lower(trim(pr.client)) in (select lower(a) from unnest(coalesce(b.aliases, '{}'::text[])) a));

update public.payments pay
   set brand_id = b.id
  from public.brands b
 where pay.brand_id is null
   and pay.client is not null
   and (lower(trim(pay.client)) = lower(b.name)
        or lower(trim(pay.client)) in (select lower(a) from unnest(coalesce(b.aliases, '{}'::text[])) a));

-- ── Ops Chat ────────────────────────────────────────────────
-- A session is one conversation thread on the dashboard. Messages hold both
-- sides; an assistant message that proposed a change points at its intent.

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- what the parser read out of a user message (intent, entities, confidence)
  parsed jsonb,
  -- set on assistant messages that carry a confirm card
  intent_id uuid,
  -- card payload the UI renders (record card, candidate list, diff table)
  card jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx
  on public.chat_messages (session_id, created_at);

-- The proposal ledger. Nothing mutates a record until a human confirms the
-- intent — the same propose→accept rule the invoice queue follows. A
-- follow-up message refines the pending intent in place; a superseded intent
-- stays for the audit trail.

create table if not exists public.update_intents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions(id) on delete set null,
  raw_text text not null,
  brand_id uuid references public.brands(id) on delete set null,
  -- [{table, op, id?, set, label}] — validated against the API allowlist on apply
  mutations jsonb not null default '[]'::jsonb,
  -- when resolution found several plausible rows, they are offered, not guessed
  candidates jsonb,
  parser text not null default 'rules' check (parser in ('rules', 'haiku', 'sonnet', 'none')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'rejected', 'superseded', 'failed')),
  result jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists update_intents_session_idx on public.update_intents (session_id);
create index if not exists update_intents_status_idx
  on public.update_intents (status) where status = 'pending';

drop trigger if exists update_intents_set_updated_at on public.update_intents;
create trigger update_intents_set_updated_at
  before update on public.update_intents
  for each row execute function public.set_updated_at();

drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

-- ── Ops history, first class ────────────────────────────────
-- BrandTimeline reconstructs history from four tables' timestamps; anything
-- that happens through chat, invoice accept, or the API can now write one
-- durable row, so "what updates did we give" has a table to answer from.

create table if not exists public.ops_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,             -- chat_update | invoice_accept | status_change | note | ...
  summary text not null,          -- one human-readable line
  brand_id uuid references public.brands(id) on delete set null,
  -- {table, id} pointers to the rows this event touched
  refs jsonb not null default '[]'::jsonb,
  payload jsonb,
  source text not null default 'chat',  -- chat | api | cron | seed
  created_at timestamptz not null default now()
);

create index if not exists ops_events_brand_idx on public.ops_events (brand_id, created_at desc);
create index if not exists ops_events_kind_idx on public.ops_events (kind);

-- ── RLS: server-only tables ─────────────────────────────────
-- All four are written and read exclusively through route handlers using the
-- service role. RLS on with no policy = deny for anon.

alter table public.chat_sessions  enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.update_intents enable row level security;
alter table public.ops_events     enable row level security;
