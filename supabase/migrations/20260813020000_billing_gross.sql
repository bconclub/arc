-- The value of the work, as distinct from the amount due on this document.
--
-- amount is what the document asks for. That is not the size of the engagement:
-- an invoice is often one instalment against a larger piece of work, and on a
-- GST invoice the amount also carries 18% that was never work.
--
-- NOW Media 2652501 is the clear case: Rs 80,000 of web development with
-- Rs 40,000 already advanced, so the document asks for Rs 40,000 while the work
-- taken on was Rs 80,000. Reading contracted value off `amount` halves it.
alter table billing_documents add column if not exists gross_amount numeric(12,2);
alter table billing_documents add column if not exists advance_paid numeric(12,2);

comment on column billing_documents.gross_amount is
  'Value of the work before GST and before any advance is deducted. Use this for contracted value, never amount.';
