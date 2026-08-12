-- Focus tasks as things in their own right.
--
-- Until now a task was an entry in projects.tasks (a JSON array), so the only
-- way to write down "call the accountant" was to first invent a project to hang
-- it off. That is backwards: most of what needs doing on a given day belongs to
-- no project at all. This table lets a task exist alone, and optionally point at
-- a project or a brand when it does belong to one.

create table if not exists focus_tasks (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  done        boolean not null default false,
  due         date,
  -- Both optional. A task with neither is perfectly valid.
  project_id  uuid references projects(id) on delete set null,
  brand_id    uuid references brands(id) on delete set null,
  -- Higher sorts first. Lets a task be pinned to the top without a due date.
  priority    smallint not null default 0,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists focus_tasks_open_idx on focus_tasks (done, priority desc, due nulls last);
create index if not exists focus_tasks_project_idx on focus_tasks (project_id) where project_id is not null;
create index if not exists focus_tasks_brand_idx on focus_tasks (brand_id) where brand_id is not null;

alter table focus_tasks enable row level security;

-- Matches every other table here: the app reaches Supabase through the service
-- role from server code only, and the anon key never touches this table.
drop policy if exists focus_tasks_service on focus_tasks;
create policy focus_tasks_service on focus_tasks
  for all to service_role using (true) with check (true);
