-- Ad reports: the daily ads snapshot the standup routine pushes for investors.
--
-- Meta's Graph API needs META_ACCESS_TOKEN, which is not set, and Meta's own
-- Ads MCP is not enabled on the PROXe account yet. Until one of those works
-- the 9am routine reads Ads Manager and the PROXe product, then writes one row
-- here per run. The investor Ads tab reads the newest row. Numbers only: no
-- lead names, phones or call notes ever land in this table.
--
-- Idempotent. Applied through public.exec_sql with the service key.

create table if not exists public.ad_reports (
  id uuid primary key default gen_random_uuid(),
  product text not null default 'proxe',
  taken_at timestamptz not null default now(),
  -- the window the numbers cover; investors only see ads from 1 Oct 2026
  since date not null,
  until date not null,
  -- where the spend came from: ads_manager | meta_api | ads_mcp
  source text,
  payload jsonb not null
);

create index if not exists ad_reports_product_taken_idx
  on public.ad_reports (product, taken_at desc);

alter table public.ad_reports enable row level security;

notify pgrst, 'reload schema';
