-- Investor portal: a read-only view of PROXe for the people who funded it.
--
-- Investors are a separate identity from the ARC owner: their own table,
-- their own password hash, their own cookie. Nothing an investor holds can
-- open the ARC dashboard or any /api/ops route.
--
-- Every table here is server-only (RLS on, no policies): investors read
-- through /api/investor/* with the service role, scoped by their session.
--
-- Idempotent. Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ── Investors ───────────────────────────────────────────────

create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  email text,
  -- "saltHex:hashHex", PBKDF2-SHA256 210k — same scheme as the owner login
  password_hash text not null,
  -- what this investor put in, so the portal can say how much has been deployed
  committed_amount numeric,
  currency text not null default 'INR',
  invested_on date,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists investors_set_updated_at on public.investors;
create trigger investors_set_updated_at
  before update on public.investors
  for each row execute function public.set_updated_at();

-- ── Updates the founder posts for investors ─────────────────

create table if not exists public.investor_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_md text not null default '',
  -- milestone | metric | product | hiring | risk | note
  kind text not null default 'note',
  published_at timestamptz not null default now(),
  -- drafts stay invisible to investors
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists investor_updates_pub_idx
  on public.investor_updates (published_at desc) where published;

-- ── Demos ───────────────────────────────────────────────────
-- Until now "demos booked" was named as a key weekly number and recorded
-- nowhere. One row per demo, linked back to the outreach target it came from
-- when there is one.

create table if not exists public.demos (
  id uuid primary key default gen_random_uuid(),
  product text not null default 'proxe',
  company text not null,
  contact text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'no_show', 'cancelled')),
  -- after a done demo: interested | trial | won | lost | follow_up
  outcome text,
  source text,                 -- outreach | inbound | referral | event
  outreach_target_id uuid references public.outreach_targets(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demos_scheduled_idx on public.demos (product, scheduled_at desc);

drop trigger if exists demos_set_updated_at on public.demos;
create trigger demos_set_updated_at
  before update on public.demos
  for each row execute function public.set_updated_at();

-- ── Spend ledger ────────────────────────────────────────────
-- Money out, which ARC never recorded. Ad spend is NOT entered here by hand:
-- it comes from Meta into ad_spend_daily below, and the portal adds the two.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  product text not null default 'proxe',
  spent_on date not null,
  -- tools | infra | calls | people | marketing | legal | other
  category text not null default 'other',
  vendor text,
  description text,
  amount numeric not null check (amount >= 0),
  currency text not null default 'INR',
  -- monthly subscriptions are entered once per month they are charged
  recurring boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists expenses_product_idx on public.expenses (product, spent_on desc);

-- ── Daily ad spend, persisted ───────────────────────────────
-- Meta only answers for windows; a stored daily row means the investor chart
-- keeps its history even if the token lapses or an account is re-linked.

create table if not exists public.ad_spend_daily (
  product text not null,
  platform text not null default 'meta',
  day date not null,
  account_id text,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  leads int not null default 0,
  currency text not null default 'INR',
  fetched_at timestamptz not null default now(),
  primary key (product, platform, day)
);

-- ── RLS: server only ────────────────────────────────────────

alter table public.investors        enable row level security;
alter table public.investor_updates enable row level security;
alter table public.demos            enable row level security;
alter table public.expenses         enable row level security;
alter table public.ad_spend_daily   enable row level security;

-- New tables are invisible to the REST layer until its schema cache reloads.
notify pgrst, 'reload schema';
