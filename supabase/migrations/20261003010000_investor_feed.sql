-- Investor feed + per-investor stake.
--
-- Updates become a plan → execute feed: each post can be a plan, in
-- execution, or done, and can carry structured detail (an ads launch carries
-- its daily budget and targeting) so the portal can render it, not just print
-- it. Investors gain what they promised vs what actually arrived, and their
-- stake, so each one sees their own share of the money deployed.
--
-- Idempotent. Run in Supabase SQL editor.

alter table public.investor_updates
  add column if not exists stage text
    check (stage is null or stage in ('plan', 'executing', 'done')),
  -- e.g. {"daily_budget": 2400, "targeting": "..."} for an ads launch
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists pinned boolean not null default false;

alter table public.investors
  -- committed_amount is what was promised; this is what has actually landed
  add column if not exists received_amount numeric,
  -- ownership percentage, when the round sets one
  add column if not exists equity_pct numeric
    check (equity_pct is null or (equity_pct >= 0 and equity_pct <= 100));

notify pgrst, 'reload schema';
