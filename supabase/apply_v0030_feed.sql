-- Investor feed + per-investor stake.
--
-- Updates become a plan → execute feed: each post can be a plan, in
-- execution, or done, and can carry structured detail (an ads launch carries
-- its daily budget and targeting) so the portal can render it, not just print
-- it. Investors gain what they promised vs what actually arrived, and their
-- stake, so each one sees their own share of the money deployed.
--
-- Idempotent. Run in Supabase SQL editor.

alter table public.investor_updates
  add column if not exists stage text
    check (stage is null or stage in ('plan', 'executing', 'done')),
  -- e.g. {"daily_budget": 2400, "targeting": "..."} for an ads launch
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists pinned boolean not null default false;

alter table public.investors
  -- committed_amount is what was promised; this is what has actually landed
  add column if not exists received_amount numeric,
  -- ownership percentage, when the round sets one
  add column if not exists equity_pct numeric
    check (equity_pct is null or (equity_pct >= 0 and equity_pct <= 100));

notify pgrst, 'reload schema';

-- ── Draft feed post: ads launch at ₹2,400/day ──
-- Saved as an UNPUBLISHED plan. Targeting below is drafted from the locked
-- ICP (gtm_areas Foundation), not read from Meta: confirm or edit it in
-- ARC → Investors → Updates, then tick "Visible to investors".
insert into public.investor_updates (title, body_md, kind, stage, published, pinned, payload)
select
  'Meta ads go live at ₹2,400/day',
  'First paid acquisition push for PROXe. Lead ads into WhatsApp, optimised for conversations with business owners who already buy ads and lose enquiries to slow replies. Goal: founding-20 customers on the ₹9,999/mo offer. Every lead lands in the PROXe dashboard and gets a founder demo.',
  'ads', 'plan', false, true,
  jsonb_build_object(
    'daily_budget', 2400,
    'targeting', E'Geo: Bangalore first (Hyderabad next)\nWho: owners and managers of coaching academies (JEE/NEET), multi-doctor clinics (dental, ortho, diagnostics), real-estate agencies, D2C brands\nSignal: already running Meta/Google ads, WhatsApp-heavy inbound\nAge: 25 to 55\nPlacements: Facebook + Instagram feeds and reels, click-to-WhatsApp'
  )
where not exists (
  select 1 from public.investor_updates where title = 'Meta ads go live at ₹2,400/day'
);

notify pgrst, 'reload schema';

select 'feed ready' as status,
       (select count(*) from public.investor_updates) as posts;
