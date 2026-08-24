-- Agent context store, 2026-08-24.
--
-- One row per (namespace, scope) holding the latest snapshot of some external
-- system, already normalised. Bots read the merged bundle from
-- /api/agent/context instead of talking to those systems themselves.
--
-- Why this exists: the bots cannot act as MCP clients. Meta's own Ads MCP is
-- OAuth-bound to an interactive session, so a Vercel cron cannot call it either.
-- Rather than teach every bot a new protocol, ARC does the pulling (Graph API,
-- RSS, MCP connector where it fits) and republishes the result as plain JSON
-- over a bearer-authed GET. Adding a new source is a new namespace, never a bot
-- change.

create table if not exists public.agent_context (
  id          uuid primary key default gen_random_uuid(),
  namespace   text not null,                          -- meta_ads | briefs | signals | pipeline | ...
  scope       text not null default 'global',         -- brand slug, or 'global' for account-wide
  payload     jsonb not null default '{}'::jsonb,     -- the structured snapshot
  -- Prose the bot can paste straight into a system prompt. Kept alongside the
  -- payload because every consumer was otherwise going to re-summarise the same
  -- JSON with its own model call, at its own cost, with its own drift.
  summary_md  text not null default '',
  source      text not null default 'unknown',        -- which puller wrote this
  fetched_at  timestamptz not null default now(),     -- when the upstream data was true
  -- Past this, readers treat the row as stale. Null means it never goes stale.
  -- A bot quoting week-old ad spend as current is worse than a bot saying it
  -- does not know, so staleness is data, not something to hide.
  expires_at  timestamptz,
  updated_at  timestamptz not null default now(),
  -- One live snapshot per namespace per scope; re-pulls upsert rather than pile up.
  unique (namespace, scope)
);

create index if not exists agent_context_ns_idx on public.agent_context (namespace);
create index if not exists agent_context_fetched_idx on public.agent_context (fetched_at desc);

-- RLS: same posture as arc_briefs. Reads open (the dashboard is password-gated at
-- the app layer, the agent route is bearer-gated), writes service-role only.
alter table public.agent_context enable row level security;

drop policy if exists agent_context_read on public.agent_context;
create policy agent_context_read on public.agent_context
  for select using (true);
