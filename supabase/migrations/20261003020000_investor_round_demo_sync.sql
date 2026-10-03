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
