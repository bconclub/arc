-- ARC: historical money. Two tables, both mirrored from the BCON spreadsheets.
--
-- Separate from `payments` on purpose. That table is what is currently owed and
-- drives the Money panel; ~500 backdated rows would swamp receivables and the
-- activity feed. These are history: read-mostly, charted, never chased.
--
-- The spreadsheets stay the source of truth. ARC mirrors them, and both imports
-- are idempotent so re-running never duplicates.

create extension if not exists "pgcrypto";

-- ── Revenue ledger (payments spreadsheet) ───────────────────

create table if not exists public.revenue_history (
  id uuid primary key default gen_random_uuid(),
  -- First day of the month the money landed. A real date so it sorts and groups;
  -- the sheet only records year + month name.
  period date not null,
  client text not null,
  -- Null is fine: many historical clients predate the brands table.
  brand_id uuid references public.brands(id) on delete set null,
  service_type text,
  amount numeric not null default 0,
  source text not null default 'sheet',
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists revenue_history_uniq
  on public.revenue_history (period, lower(client), coalesce(lower(service_type), ''), amount);
create index if not exists revenue_history_period_idx on public.revenue_history (period);
create index if not exists revenue_history_client_idx on public.revenue_history (lower(client));
create index if not exists revenue_history_brand_idx  on public.revenue_history (brand_id);

-- ── GST invoices (GST spreadsheet) ──────────────────────────

create table if not exists public.gst_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text,
  issued_on date,
  client text not null,
  brand_id uuid references public.brands(id) on delete set null,
  billed_amount numeric,          -- ex-GST, blank on one omitted row in the sheet
  total_amount numeric,
  gst_amount numeric,
  gstin text,
  -- Yes / Cancelled / Omitted / blank(= not filed yet) in the source sheet.
  gst_status text not null default 'unfiled',
  notes text,
  created_at timestamptz not null default now()
);

-- Invoice numbers restart each financial year, so the number alone is not unique.
create unique index if not exists gst_invoices_uniq
  on public.gst_invoices (coalesce(invoice_no, ''), coalesce(issued_on, '1900-01-01'), lower(client));
create index if not exists gst_invoices_date_idx  on public.gst_invoices (issued_on);
create index if not exists gst_invoices_brand_idx on public.gst_invoices (brand_id);

-- ── RLS (matches the other ops tables) ──────────────────────

alter table public.revenue_history enable row level security;
alter table public.gst_invoices    enable row level security;

drop policy if exists "Allow all revenue_history" on public.revenue_history;
create policy "Allow all revenue_history" on public.revenue_history for all using (true) with check (true);

drop policy if exists "Allow all gst_invoices" on public.gst_invoices;
create policy "Allow all gst_invoices" on public.gst_invoices for all using (true) with check (true);

-- ── Views for the Analytics page ────────────────────────────
-- Aggregating in SQL avoids shipping the whole ledger to the browser.

create or replace view public.revenue_by_month as
  select period,
         sum(amount) as amount,
         count(*) as line_items,
         count(distinct lower(client)) as clients
  from public.revenue_history
  group by period
  order by period;

create or replace view public.revenue_by_client as
  select lower(client) as client_key,
         min(client)   as client,
         -- uuid has no max()/min() aggregate, so pick the first non-null id.
         (array_agg(brand_id) filter (where brand_id is not null))[1] as brand_id,
         sum(amount)   as lifetime,
         min(period)   as first_paid,
         max(period)   as last_paid,
         count(*)      as line_items
  from public.revenue_history
  group by lower(client)
  order by sum(amount) desc;

-- Indian financial year runs April→March, so FY2024-25 starts 2024-04-01.
create or replace view public.revenue_by_fy as
  select case when extract(month from period) >= 4
              then extract(year from period)
              else extract(year from period) - 1
         end::int                      as fy_start,
         sum(amount)                   as amount,
         count(distinct lower(client)) as clients
  from public.revenue_history
  group by 1
  order by 1;

NOTIFY pgrst, 'reload schema';
