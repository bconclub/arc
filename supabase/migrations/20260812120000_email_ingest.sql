-- ARC: remember which invoice emails have already been read.
--
-- Without this, every scan re-downloads and re-parses every invoice attachment
-- it can see. Each PDF is a model call, so a nightly cron would spend real money
-- re-reading the same July invoices for the rest of time, and would keep
-- proposing figures that were already accepted or already rejected.
--
-- Additive and idempotent.

create extension if not exists "pgcrypto";

create table if not exists public.email_ingest (
  id uuid primary key default gen_random_uuid(),

  -- Gmail's ids. The pair is what makes a single attachment unique: one message
  -- can carry several PDFs, and the same attachment id is only meaningful
  -- within its message.
  message_id text not null,
  attachment_id text not null,
  filename text,

  -- Kept so the review queue can show where a figure came from without a second
  -- round trip to Gmail.
  subject text,
  from_address text,
  sent_at timestamptz,

  -- Whatever the parser read, stored verbatim. Keeping the raw reading means a
  -- rejected proposal can be re-examined without paying to read the file again.
  parsed jsonb,
  confidence text,

  -- pending: parsed, waiting for a human decision
  -- accepted: written onto a payment row
  -- rejected: deliberately dismissed, never offer it again
  -- failed: could not be read, see error
  status text not null default 'pending',
  error text,

  -- Set when accepted, so a figure can be traced back to the document it came from.
  payment_id uuid references public.payments(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per attachment. This is the guard that makes re-running a scan free.
create unique index if not exists email_ingest_uniq
  on public.email_ingest (message_id, attachment_id);

create index if not exists email_ingest_status_idx on public.email_ingest (status);
create index if not exists email_ingest_sent_idx on public.email_ingest (sent_at desc);

alter table public.email_ingest enable row level security;

drop policy if exists "Allow all email_ingest" on public.email_ingest;
create policy "Allow all email_ingest" on public.email_ingest for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
