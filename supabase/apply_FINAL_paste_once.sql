-- Rounds on investors; idempotent demo sync from PROXe.
--
-- An investor belongs to a round (Pre-seed: 5% for ₹25L). Equity is stated
-- for the full commitment; the portal shows what has been earned on what
-- has actually arrived.
--
-- Demos booked inside PROXe (all_leads.booking_date) are mirrored into
-- demos, keyed on the PROXe lead + booking date so a re-sync updates rather
-- than duplicates.
--
-- Idempotent. Run in Supabase SQL editor (project niypveotxuledkrcikun).

alter table public.investors
  add column if not exists round text;

alter table public.demos
  add column if not exists external_id text;

create unique index if not exists demos_external_id_key
  on public.demos (external_id) where external_id is not null;

notify pgrst, 'reload schema';

-- 1. Private updates: a post can be addressed to one investor.
-- 2. A migration runner, so schema changes stop needing a human at the SQL editor.
--
-- exec_sql is SECURITY DEFINER and executable by service_role ONLY. The
-- service key can already read and delete every row, so this adds schema
-- power to a credential that is already total over the data, and nothing
-- for anon or signed-in users. Revoke it any time:
--   drop function public.exec_sql(text);
--
-- Idempotent. Run in Supabase SQL editor (project niypveotxuledkrcikun).

alter table public.investor_updates
  add column if not exists investor_id uuid references public.investors(id) on delete cascade;

create index if not exists investor_updates_investor_idx
  on public.investor_updates (investor_id) where investor_id is not null;

-- 3. Spend accountability: every rupee out names who approved it and which
--    department it went through.
alter table public.expenses
  add column if not exists approved_by text,
  add column if not exists department text;

update public.expenses set approved_by = 'Thanzeel Ashruf (Founder)' where approved_by is null;
update public.expenses set department = case
    when category = 'ad_topup' then 'Marketing'
    when vendor = 'Anthropic' then 'Engineering'
    when vendor = 'ComfyUI' then 'Marketing'
    when category in ('tools', 'infra') then 'Engineering'
    when category = 'calls' then 'Sales'
    else 'Operations'
  end
  where department is null;

create or replace function public.exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute sql;
end;
$$;

revoke all on function public.exec_sql(text) from public;
revoke all on function public.exec_sql(text) from anon;
revoke all on function public.exec_sql(text) from authenticated;
grant execute on function public.exec_sql(text) to service_role;

notify pgrst, 'reload schema';
