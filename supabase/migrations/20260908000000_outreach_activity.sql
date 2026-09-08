begin;
-- Separate work history from the sales stage. Existing targets/messages remain intact.
create table if not exists public.outreach_activity (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.outreach_targets(id) on delete cascade,
  channel text not null check (channel in ('call','citation','email','whatsapp','linkedin')),
  outcome text not null,
  worker text not null,
  external_id text not null,
  occurred_at timestamptz not null,
  summary text not null default '',
  evidence_url text,
  next_at timestamptz,
  created_at timestamptz not null default now(),
  unique (worker, external_id)
);
create index if not exists outreach_activity_target_time on public.outreach_activity(target_id, occurred_at desc);
alter table public.outreach_activity enable row level security;
revoke all on public.outreach_activity from anon, authenticated;
grant select, insert on public.outreach_activity to service_role;
-- Events are append-only. Retry the same event ID; a new outcome gets a new event ID.
-- No invented backfill: historic submissions keep their unverified label in the UI.

alter table public.outreach_targets add column if not exists promoted_at timestamptz;
alter table public.outreach_targets add column if not exists proxe_lead_id uuid;
alter table public.outreach_targets add column if not exists qualified_at timestamptz;
alter table public.outreach_targets add column if not exists qualification_note text;
alter table public.outreach_messages add column if not exists provider_conversation_id text;
create unique index if not exists outreach_message_call_once on public.outreach_messages(provider_conversation_id) where provider_conversation_id is not null;
create table if not exists public.outreach_dial_reservations (
 phone text primary key, reservation_id uuid not null, reserved_at timestamptz not null, worker text not null
);
alter table public.outreach_dial_reservations enable row level security;
revoke all on public.outreach_dial_reservations from anon, authenticated;
create or replace function public.reserve_outreach_dial(dial_phone text,worker_name text) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if dial_phone !~ '^[0-9]{10}$' then raise exception 'Invalid phone'; end if;
 insert into public.outreach_dial_reservations(phone,reservation_id,reserved_at,worker)
 values(dial_phone,gen_random_uuid(),now(),worker_name)
 on conflict(phone) do update set reservation_id=excluded.reservation_id,reserved_at=excluded.reserved_at,worker=excluded.worker
 where outreach_dial_reservations.reserved_at<=now()-interval '24 hours'
 returning reservation_id into result;
 return result;
end; $$;
revoke all on function public.reserve_outreach_dial(text,text) from public,anon,authenticated;
grant execute on function public.reserve_outreach_dial(text,text) to service_role;

-- Qualification is server-owned. Outreach UI reads/writes through authenticated APIs.
revoke all on public.outreach_targets, public.outreach_messages from anon, authenticated;
grant all on public.outreach_targets, public.outreach_messages to service_role;

commit;
