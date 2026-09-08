-- PROXe conversations land on the same outreach thread as ARC outbound.
-- Instagram and web chat are real channels on the product, not aliases of WhatsApp.

alter table public.outreach_messages
  drop constraint if exists outreach_messages_channel_check;

alter table public.outreach_messages
  add constraint outreach_messages_channel_check
  check (channel in ('email', 'linkedin', 'whatsapp', 'call', 'instagram', 'web'));
