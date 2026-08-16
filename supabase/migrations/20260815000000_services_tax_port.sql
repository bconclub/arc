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
