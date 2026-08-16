-- ARC Twin: richer projects — links, walkthrough notes, reusable category,
-- and a malleable per-project payment schedule.
-- Idempotent. Run in Supabase SQL editor.

alter table public.projects
  add column if not exists category text,             -- reusable keyword (e.g. "Website Redesign")
  add column if not exists notes text,                -- walkthrough / what we're building
  add column if not exists links jsonb not null default '[]'::jsonb,            -- [{label,url}]
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb; -- [{label,amount,due,paid}]
