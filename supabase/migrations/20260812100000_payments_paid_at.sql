-- ARC: record WHEN an invoice was paid, not just that it was.
--
-- `payments` has `due` but nothing saying when money actually landed, so
-- "average time to get paid" cannot be computed at all. That figure is one of
-- the headline stats on the Invoices screen and it is the only one there with
-- no honest value behind it today.
--
-- Additive and idempotent: nothing is dropped, and re-running is a no-op.

alter table public.payments
  add column if not exists paid_at date;

comment on column public.payments.paid_at is
  'Date the payment actually landed. Null for anything not yet paid, and null on
   historical paid rows where the real date was never recorded.';

create index if not exists payments_paid_at_idx on public.payments (paid_at);

-- Backfill is deliberately conservative.
--
-- The honest options for an already-paid row are its due date or its created_at,
-- and both are guesses: due is when we ASKED to be paid, created_at is when the
-- row was typed in. Either would silently manufacture the very number the column
-- exists to measure, and a fabricated average is worse than an absent one.
--
-- So paid rows keep paid_at null and are excluded from the average until a real
-- date is entered. The UI states how many rows are excluded rather than quietly
-- averaging a subset.

-- Keeps status and paid_at from contradicting each other: a row that carries a
-- paid date is paid, whatever the status column happened to say.
update public.payments
   set status = 'paid'
 where paid_at is not null
   and status <> 'paid';

NOTIFY pgrst, 'reload schema';
