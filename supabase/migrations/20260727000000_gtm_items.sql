-- ARC Twin: per-area GTM sub-items with their own status.
-- Each GTM area (Foundation, Positioning, …) breaks into concrete sub-items
-- (Market Definition, ICP, …), each tracked not_started → in_progress →
-- defined → validated. Stored as jsonb [{name, status}]; the item NAMES are
-- the fixed taxonomy (client-side), the DB persists each item's status.
-- Idempotent. Run in Supabase SQL editor.

alter table public.gtm_areas
  add column if not exists items jsonb not null default '[]'::jsonb;
