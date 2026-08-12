-- The billing vault: every document ever issued, invoice or quote.
--
-- This is deliberately NOT the payments table. `payments` is the working set,
-- what is owed right now, and receivables is computed from it. The vault is the
-- record of what was billed, going back to 2021. Loading 38 historical invoices
-- into payments would have reported roughly Rs 20 lakh of outstanding money that
-- was mostly collected years ago.
--
-- Settlement is recorded as unknown rather than guessed. The source sheet says
-- what was billed and is silent on what was paid, and a fabricated "paid" on a
-- money row is worse than an honest gap.

create table if not exists billing_documents (
  id            uuid primary key default gen_random_uuid(),

  -- 'invoice', 'quote', or 'unclear' where the document contradicts itself:
  -- one is headed Quote while numbering the field "Invoice No", and one does
  -- the reverse. Whether they are revenue is a question only a human can close.
  kind          text not null default 'invoice',
  doc_no        text,
  -- The sheet's own client code, e.g. GMPMW. Present on every document and a
  -- far better join key than the client name, which is spelled several ways.
  client_id     text,
  issued_on     date,
  client_name   text not null,
  brand_id      uuid references brands(id) on delete set null,

  amount        numeric(12,2),
  -- Null means no GST was charged, which is the majority. The rate is kept
  -- rather than a boolean, since 18% and IGST 18% are not the same thing.
  gst_pct       numeric(5,2),
  -- 'BCON Club' invoices carry GST and settle to the HDFC account; those in a
  -- personal name do not. This is the actual line the GST split falls along.
  billed_as     text,
  description   text,

  -- 'unknown' until somebody confirms it. Never inferred.
  settlement    text not null default 'unknown',
  settled_on    date,

  source        text not null default 'bcon-invoice-sheet',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Invoice 4230201 is genuinely used twice in the source, on RLTR Group and
-- Organix Rosa, both dated 02-04-2023. So the number alone cannot be unique;
-- number plus client can, and re-running the import stays idempotent.
create unique index if not exists billing_documents_key
  on billing_documents (coalesce(doc_no, ''), lower(client_name), coalesce(issued_on, '1900-01-01'::date));

create index if not exists billing_documents_brand_idx on billing_documents (brand_id);
create index if not exists billing_documents_issued_idx on billing_documents (issued_on desc);
create index if not exists billing_documents_gst_idx on billing_documents (gst_pct) where gst_pct is not null;

alter table billing_documents enable row level security;
drop policy if exists billing_documents_service on billing_documents;
create policy billing_documents_service on billing_documents
  for all to service_role using (true) with check (true);

-- Photos of people, so two contacts at the same client are not represented by
-- the same brand logo.
alter table people add column if not exists avatar_url text;
