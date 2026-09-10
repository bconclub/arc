begin;

-- Allow scheduled callback exception to 24h dial cooldown.
-- Incident 2026-09-09: Aadya Whitefield morning dial blocked evening callback.
-- Solution: when a target has next_at due, bypass the cooldown.

-- Drop the existing function to recreate with new signature.
drop function if exists public.reserve_outreach_dial(text,text);

-- New signature accepts optional target_id to check for scheduled callbacks.
create or replace function public.reserve_outreach_dial(
  dial_phone text,
  worker_name text,
  target_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  result uuid;
  is_callback boolean := false;
begin
  if dial_phone !~ '^[0-9]{10}$' then
    raise exception 'Invalid phone';
  end if;

  -- Check if this is a due scheduled callback (exception to 24h cooldown).
  -- Only grant exception when target explicitly provided and has next_at due.
  if target_id is not null then
    select exists(
      select 1 from outreach_targets t
      where t.id = target_id
        and t.next_at is not null
        and t.next_at <= now()
        and t.status not in ('lost', 'won')
    ) into is_callback;
  end if;

  -- Reserve: insert new or update existing reservation.
  -- Normal path: only update if reserved_at is stale (>= 24 hours old).
  -- Callback exception: allow update regardless of reserved_at age.
  insert into public.outreach_dial_reservations(phone, reservation_id, reserved_at, worker)
  values(dial_phone, gen_random_uuid(), now(), worker_name)
  on conflict(phone) do update
    set reservation_id = excluded.reservation_id,
        reserved_at = excluded.reserved_at,
        worker = excluded.worker
  where is_callback
     or outreach_dial_reservations.reserved_at <= now() - interval '24 hours'
  returning reservation_id into result;

  return result;
end; $$;

revoke all on function public.reserve_outreach_dial(text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_outreach_dial(text,text,uuid) to service_role;

commit;
