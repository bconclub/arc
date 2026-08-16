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
