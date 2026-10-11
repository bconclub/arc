-- Fleet: every machine and Claude session reports into ARC, so one place knows what
-- BCON Main, BCON Worker and MAC Worker are doing, and render jobs go to the machine
-- that can actually run them.
--
-- Builds on the agent queue (20260815000001_agent_queue_social.sql) — no new queue:
--   agent_heartbeats  gains machine / kind / capabilities / status / current job
--   agent_jobs        gains a required capability and live progress
--   claim_agent_job   only hands a job to a worker that has the capability
--
-- Idempotent. Run in Supabase SQL editor.

-- ── Who is reporting ────────────────────────────────────────
-- agent stays the identity (x-agent-name), e.g. 'bcon-main/worker', 'mac-worker/hub',
-- 'bcon-worker/session:proxe'. machine groups them.

alter table public.agent_heartbeats add column if not exists machine text;
alter table public.agent_heartbeats add column if not exists kind text;           -- worker | session | hub
alter table public.agent_heartbeats add column if not exists project text;        -- arc | proxe | goproxe | editr | …
alter table public.agent_heartbeats add column if not exists status text;         -- idle | working | needs_input | finished | error
alter table public.agent_heartbeats add column if not exists capabilities text[] not null default '{}';
alter table public.agent_heartbeats add column if not exists current_job uuid;
alter table public.agent_heartbeats add column if not exists progress int;

create index if not exists agent_heartbeats_machine_idx on public.agent_heartbeats (machine);

-- ── Jobs that need a particular machine ─────────────────────

alter table public.agent_jobs add column if not exists required_capability text;  -- gpu | ffmpeg | blender | comfyui | …
alter table public.agent_jobs add column if not exists progress int;              -- 0..100
alter table public.agent_jobs add column if not exists stage text;
alter table public.agent_jobs add column if not exists log_tail text;             -- last few lines, for "why is it stuck"

-- Same claim as before, plus: a job with a required capability only goes to a worker
-- that lists it. Old callers ({worker, kinds}) keep working — caps defaults to null,
-- and a worker with no caps only gets jobs that need none.
drop function if exists public.claim_agent_job(text, text[]);
create or replace function public.claim_agent_job(worker text, kinds text[] default null, caps text[] default null)
returns setof public.agent_jobs as $$
  update public.agent_jobs j
     set status = 'running',
         claimed_by = worker,
         claimed_at = now(),
         attempts = j.attempts + 1,
         progress = 0,
         stage = null
   where j.id = (
     select id from public.agent_jobs
      where status = 'queued'
        and run_at <= now()
        and (kinds is null or kind = any(kinds))
        and (required_capability is null or required_capability = any(coalesce(caps, '{}')))
      order by priority, run_at
      limit 1
      for update skip locked
   )
  returning j.*;
$$ language sql;

-- ── The fleet at a glance ───────────────────────────────────
-- agent_liveness calls an agent stale after 12h (a quiet inbox is normal). Machines
-- and sessions report every minute, so for them 10 minutes of silence means trouble.

create or replace view public.fleet_status as
  select h.machine, h.agent, h.kind, h.project, h.status, h.capabilities,
         h.note, h.version, h.last_seen, h.healthy,
         extract(epoch from (now() - h.last_seen)) / 60 as minutes_since,
         (now() - h.last_seen) > interval '10 minutes' as stale,
         h.current_job, j.kind as job_kind, j.stage as job_stage,
         coalesce(j.progress, h.progress) as progress
    from public.agent_heartbeats h
    left join public.agent_jobs j on j.id = h.current_job
   where h.machine is not null;

-- Heartbeats are service-role only (RLS, no anon policy). A plain view would read them
-- as its owner and leak them to the anon key; run it as the caller instead.
alter view public.fleet_status set (security_invoker = true);
revoke all on public.fleet_status from anon, authenticated;
