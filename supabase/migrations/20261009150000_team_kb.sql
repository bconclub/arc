-- The sales team's knowledge base: the pipeline (the main page), what PROXe is,
-- links to share and when, rebuttals, pricing, process and FAQs. One row per
-- entry, searchable in /team/playbook and the only source the Ask assistant
-- answers from. The owner edits entries on /dashboard/team; PROXe can push its
-- own (source 'proxe', keyed by external_id) to /api/agent/team-kb. Idempotent.

create table if not exists public.team_kb (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('pipeline', 'product', 'bcon', 'pricing', 'links', 'rebuttals', 'process', 'faq')),
  title text not null,
  body text not null default '',          -- markdown
  url text,                               -- links: the thing to share
  when_to_share text,                     -- links: the moment it helps
  tags text[] not null default '{}',
  position int not null default 0,        -- order within a section (pipeline: stage order)
  source text not null default 'arc' check (source in ('arc', 'proxe')),
  external_id text,                       -- set by PROXe pushes, for upserts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Plain (not partial) so upserts can target it; NULL external_ids never collide.
create unique index if not exists team_kb_external on public.team_kb (source, external_id);
create index if not exists team_kb_section on public.team_kb (section, position);
drop trigger if exists team_kb_set_updated_at on public.team_kb;
create trigger team_kb_set_updated_at before update on public.team_kb
  for each row execute function public.set_updated_at();

alter table public.team_kb enable row level security;
revoke all on public.team_kb from anon, authenticated;
grant all on public.team_kb to service_role;
