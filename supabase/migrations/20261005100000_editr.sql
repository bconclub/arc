-- Editr: the video and content agents' desk, mirrored into ARC.
--
-- Source of truth stays the bconclub/editor repo (tasks/*/TASK.md, metrics/). Each machine runs
-- `python scripts/tasks.py sync`, which posts to /api/agent/editr/ingest; that route upserts here.
-- These tables are the history: every sync is idempotent, every task status change is an event.
--
-- RLS on, no policies: only the service role (server routes) reads or writes. Idempotent.

create table if not exists public.editr_usage (
  day          date        not null,
  agent        text        not null,
  host         text        not null,
  model        text        not null,
  speed        text        not null default 'standard',
  input        bigint      not null default 0,
  output       bigint      not null default 0,
  cache_read   bigint      not null default 0,
  cache_write_5m bigint    not null default 0,
  cache_write_1h bigint    not null default 0,
  messages     integer     not null default 0,
  cost_usd     numeric(14,4) not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (day, agent, host, model, speed)
);

create table if not exists public.editr_outputs (
  id          text primary key,            -- task + kind + file, so re-syncs never duplicate
  date        date not null,
  task        text not null,
  agent       text not null,
  kind        text not null check (kind in ('final', 'draft', 'source')),
  file        text not null,
  seconds     numeric(10,2) not null,
  width       integer,
  height      integer,
  brand       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.editr_tasks (
  id              text primary key,
  title           text not null,
  brand           text,
  project         text,
  type            text,
  owner           text,
  status          text not null,
  effective       text not null,
  priority        text,
  due             text,
  blocked_by      text[] not null default '{}',
  waiting_on      text,
  drive           text,
  output          text,
  progress_done   integer not null default 0,
  progress_total  integer not null default 0,
  last_log        text,
  path            text,
  first_seen_at   timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.editr_task_events (
  id          bigserial primary key,
  task_id     text not null,
  at          timestamptz not null default now(),
  from_status text,
  to_status   text not null,
  note        text,
  host        text
);

create index if not exists editr_usage_day_idx on public.editr_usage (day);
create index if not exists editr_outputs_date_idx on public.editr_outputs (date);
create index if not exists editr_task_events_task_idx on public.editr_task_events (task_id, at desc);

alter table public.editr_usage enable row level security;
alter table public.editr_outputs enable row level security;
alter table public.editr_tasks enable row level security;
alter table public.editr_task_events enable row level security;
