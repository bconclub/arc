-- A round is the company's, not an investor's: its own terms and window.
-- Investors carry only what they actually sent; their equity is derived
-- from it at the round's price (received / post-money).
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  target_amount numeric not null,
  equity_offered_pct numeric not null check (equity_offered_pct > 0 and equity_offered_pct <= 100),
  opens_on date not null,
  closes_on date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.rounds enable row level security;
insert into public.rounds (name, target_amount, equity_offered_pct, opens_on, closes_on)
values ('Pre-seed', 2500000, 5, date '2026-10-03', date '2027-03-31')
on conflict (name) do nothing;
notify pgrst, 'reload schema';
