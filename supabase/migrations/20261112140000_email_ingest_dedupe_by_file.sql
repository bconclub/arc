-- Gmail attachment ids change on every fetch, so the invoice scanner re-queued the
-- same invoices on every run (about 74,000 rows for 41 files, 4 to 12 Nov 2026).
-- Keep one row per message + file (decided rows first), drop pasted inline images,
-- and make message + file the identity from now on. Applied 12 Nov 2026.
delete from public.email_ingest
 where filename ~* '^image\d*\.(png|jpe?g|gif)$' and status in ('pending', 'failed');

delete from public.email_ingest e
 using (
   select id, row_number() over (
     partition by message_id, filename
     order by case status when 'accepted' then 0 when 'rejected' then 1 when 'pending' then 2 else 3 end, created_at
   ) as rn
   from public.email_ingest
 ) d
 where e.id = d.id and d.rn > 1;

create unique index if not exists email_ingest_msg_file on public.email_ingest (message_id, filename);
