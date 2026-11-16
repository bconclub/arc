-- Bank SMS inbox: every credit and debit the phone worker reads from bank SMS.
--
-- The phone forwards only messages that look like a bank transaction and never an
-- OTP; ARC parses them (src/lib/bank-sms.ts) and stores one row per transaction.
-- Balances are stripped from `body` before it is saved.
--
-- `dedupe_key` makes re-sending the same SMS (backfill, retries) a no-op.
-- `payment_id` links a credit to the invoice/receivable it settles.
-- `counterparty` + `brand_id`/`label` let the next credit from the same sender be
-- tagged automatically.

create table if not exists public.bank_txns (
  id            uuid primary key default gen_random_uuid(),
  dedupe_key    text not null unique,
  bank          text,
  account       text,
  direction     text not null check (direction in ('credit', 'debit')),
  amount        numeric not null,
  currency      text not null default 'INR',
  txn_at        timestamptz not null,
  channel       text,
  counterparty  text,
  ref           text,
  sender        text,
  body          text,
  status        text not null default 'new' check (status in ('new', 'matched', 'business', 'personal', 'ignored')),
  label         text,
  brand_id      uuid references public.brands(id) on delete set null,
  payment_id    uuid references public.payments(id) on delete set null,
  device        text,
  created_at    timestamptz not null default now()
);

create index if not exists bank_txns_txn_at_idx on public.bank_txns (txn_at desc);
create index if not exists bank_txns_counterparty_idx on public.bank_txns (lower(counterparty));

alter table public.bank_txns enable row level security;
