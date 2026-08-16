-- Ops Chat, the update-intent ledger, first-class ops history, and the
-- brand_id backfill that makes free-text `client` a display column rather
-- than the join key.
--
-- The FK columns themselves come from 20260815000000_services_tax_port.sql;
-- this migration fills them from the alias registry and adds what the chat
-- layer and the invoice parser need to persist.
--
-- Idempotent. Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ── Parser fields the accept path was dropping ──────────────
-- taxable_value / cgst / sgst / igst exist for the CA-grade split; tax_amount
-- is the parser's undivided figure, kept as stated on the document rather
-- than guessed into a split that may be wrong.

alter table public.payments
  add column if not exists tax_amount numeric,
  add column if not exists gstin text;

alter table public.email_ingest
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists email_ingest_brand_idx on public.email_ingest (brand_id);

-- ── Backfill brand_id from the alias registry ───────────────
-- Matching normalises against name + aliases, the same rule rollup.ts uses.
-- Only null rows are touched, so re-running never overwrites a manual link.

update public.projects p
   set brand_id = b.id
  from public.brands b
 where p.brand_id is null
   and p.client is not null
   and (lower(trim(p.client)) = lower(b.name)
        or lower(trim(p.client)) in (select lower(a) from unnest(coalesce(b.aliases, '{}'::text[])) a));

update public.proposals pr
   set brand_id = b.id
  from public.brands b
 where pr.brand_id is null
   and pr.client is not null
   and (lower(trim(pr.client)) = lower(b.name)
        or lower(trim(pr.client)) in (select lower(a) from unnest(coalesce(b.aliases, '{}'::text[])) a));

update public.payments pay
   set brand_id = b.id
  from public.brands b
 where pay.brand_id is null
   and pay.client is not null
   and (lower(trim(pay.client)) = lower(b.name)
        or lower(trim(pay.client)) in (select lower(a) from unnest(coalesce(b.aliases, '{}'::text[])) a));

-- ── Ops Chat ────────────────────────────────────────────────
-- A session is one conversation thread on the dashboard. Messages hold both
-- sides; an assistant message that proposed a change points at its intent.

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- what the parser read out of a user message (intent, entities, confidence)
  parsed jsonb,
  -- set on assistant messages that carry a confirm card
  intent_id uuid,
  -- card payload the UI renders (record card, candidate list, diff table)
  card jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx
  on public.chat_messages (session_id, created_at);

-- The proposal ledger. Nothing mutates a record until a human confirms the
-- intent — the same propose→accept rule the invoice queue follows. A
-- follow-up message refines the pending intent in place; a superseded intent
-- stays for the audit trail.

create table if not exists public.update_intents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions(id) on delete set null,
  raw_text text not null,
  brand_id uuid references public.brands(id) on delete set null,
  -- [{table, op, id?, set, label}] — validated against the API allowlist on apply
  mutations jsonb not null default '[]'::jsonb,
  -- when resolution found several plausible rows, they are offered, not guessed
  candidates jsonb,
  parser text not null default 'rules' check (parser in ('rules', 'haiku', 'sonnet', 'none')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'rejected', 'superseded', 'failed')),
  result jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists update_intents_session_idx on public.update_intents (session_id);
create index if not exists update_intents_status_idx
  on public.update_intents (status) where status = 'pending';

drop trigger if exists update_intents_set_updated_at on public.update_intents;
create trigger update_intents_set_updated_at
  before update on public.update_intents
  for each row execute function public.set_updated_at();

drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

-- ── Ops history, first class ────────────────────────────────
-- BrandTimeline reconstructs history from four tables' timestamps; anything
-- that happens through chat, invoice accept, or the API can now write one
-- durable row, so "what updates did we give" has a table to answer from.

create table if not exists public.ops_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,             -- chat_update | invoice_accept | status_change | note | ...
  summary text not null,          -- one human-readable line
  brand_id uuid references public.brands(id) on delete set null,
  -- {table, id} pointers to the rows this event touched
  refs jsonb not null default '[]'::jsonb,
  payload jsonb,
  source text not null default 'chat',  -- chat | api | cron | seed
  created_at timestamptz not null default now()
);

create index if not exists ops_events_brand_idx on public.ops_events (brand_id, created_at desc);
create index if not exists ops_events_kind_idx on public.ops_events (kind);

-- ── RLS: server-only tables ─────────────────────────────────
-- All four are written and read exclusively through route handlers using the
-- service role. RLS on with no policy = deny for anon.

alter table public.chat_sessions  enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.update_intents enable row level security;
alter table public.ops_events     enable row level security;
