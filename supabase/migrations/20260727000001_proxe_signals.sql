-- PROXe wing: signals coming FROM the PROXe product into ARC (the fortress frontend).
-- Daily briefs + pattern extraction land here; ARC's /dashboard/proxe renders them.
-- Issues/updates reuse the same table via `kind` so one wing shows all PROXe signal.

create table if not exists public.arc_briefs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'brief',      -- brief | issue | update
  brand       text not null,                       -- bcon | windchasers | lokazen | pop | proxe
  brief_date  date not null,                       -- the day the signal covers
  title       text not null,
  body_md     text not null default '',            -- the model's markdown (patterns, etc.)
  totals      jsonb not null default '{}'::jsonb,   -- {new_leads, conversations, ...}
  source      text default 'daily-brief',
  created_at  timestamptz not null default now(),
  -- one brief per brand per day per kind; re-runs upsert instead of duplicating
  unique (kind, brand, brief_date)
);

create index if not exists arc_briefs_date_idx on public.arc_briefs (brief_date desc);
create index if not exists arc_briefs_brand_idx on public.arc_briefs (brand);

-- RLS: ARC reads via anon (dashboard is password-gated at the app layer), writes via
-- service role only (the ingest API + generator). Enable RLS, allow anon SELECT,
-- block anon writes (service role bypasses RLS).
alter table public.arc_briefs enable row level security;

drop policy if exists arc_briefs_read on public.arc_briefs;
create policy arc_briefs_read on public.arc_briefs
  for select using (true);
