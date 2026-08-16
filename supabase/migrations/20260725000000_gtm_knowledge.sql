-- ARC Twin: GTM grounding knowledge base.
-- The 16 top-level go-to-market areas the system should always be grounded on.
-- Each area = what it is (guidance) + where we stand (our content) + status.
-- ARC/Supabase is master; a script mirrors these to an Obsidian vault.
-- Idempotent. Run in Supabase SQL editor.

create table if not exists public.gtm_areas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  ord int not null default 0,
  what text,                    -- what this area is (pre-filled guidance)
  stand text,                   -- where we stand: our current state (we fill)
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'defined', 'validated')),
  updated_at timestamptz not null default now()
);

drop trigger if exists gtm_areas_set_updated_at on public.gtm_areas;
create trigger gtm_areas_set_updated_at
  before update on public.gtm_areas
  for each row execute function public.set_updated_at();

alter table public.gtm_areas enable row level security;
drop policy if exists "Allow all gtm_areas" on public.gtm_areas;
create policy "Allow all gtm_areas" on public.gtm_areas for all using (true) with check (true);

insert into public.gtm_areas (slug, title, ord, what) values
  ('foundation',         'Foundation',         1,  'Who we serve and why we exist: market definition, ICP, buyer personas, jobs-to-be-done, TAM/SAM/SOM.'),
  ('positioning',        'Positioning',        2,  'How we are seen vs alternatives: value prop, differentiation, category design, competitive positioning, the positioning statement.'),
  ('messaging',          'Messaging',          3,  'What we say and how: core narrative, messaging framework, taglines, objection handling, message testing.'),
  ('pricing',            'Pricing',            4,  'How we package and charge: pricing research, tiers, pricing metrics, discount policy, the pricing page.'),
  ('channels',           'Channels',           5,  'Where we reach buyers: channel strategy, inbound, outbound, partnerships, channel testing.'),
  ('sales_motion',       'Sales Motion',       6,  'How deals get done: self-serve, sales-led, product-led, sales playbook, demo scripts.'),
  ('content_engine',     'Content Engine',     7,  'What we publish to pull demand: content strategy, SEO content, case studies, lead magnets, sales enablement.'),
  ('launch_plan',        'Launch Plan',        8,  'How we ship to market: launch tiers, timeline, press & PR, launch assets, internal alignment.'),
  ('demand_generation',  'Demand Generation',  9,  'How we create pipeline: paid ads, email campaigns, webinars, events, social selling, ABM.'),
  ('pipeline',           'Pipeline',           10, 'How leads move: lead scoring, routing, qualification framework, CRM setup, pipeline reviews.'),
  ('conversion',         'Conversion',         11, 'How we close: trial optimization, sales process, proposal templates, negotiation, closing playbook.'),
  ('customer_success',   'Customer Success',   12, 'How we retain and grow: onboarding flow, success milestones, QBRs, renewal strategy, advocacy.'),
  ('metrics',            'Metrics',            13, 'How we measure: CAC & LTV, funnel metrics, attribution, GTM dashboard, win/loss analysis.'),
  ('expansion_revenue',  'Expansion Revenue',  14, 'How we grow accounts: upsell plays, cross-sell, seat expansion, usage expansion, enterprise motion.'),
  ('optimization',       'Optimization',       15, 'How we improve: A/B testing, funnel fixes, message iteration, doubling down, kill list.'),
  ('scale',              'Scale',              16, 'How we expand the machine: new segments, new geographies, GTM hiring, RevOps, repeatable playbooks.')
on conflict (slug) do nothing;
