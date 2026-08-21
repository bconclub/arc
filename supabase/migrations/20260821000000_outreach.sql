-- ARC Outreach wing: one pipeline for GTM outbound.
-- Four kinds share the table: business (10/day founder emails), investor,
-- grant (the Raise track), citation (AEO placements for goproxe.com).
-- Messages are drafted into Gmail Drafts; Z sends by hand, so there is no
-- send state here beyond what Z marks. Idempotent. Run in Supabase SQL editor.

create table if not exists public.outreach_targets (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'business'
    check (kind in ('business', 'investor', 'grant', 'citation')),
  name text not null,                -- person (business/investor) or program/placement name
  org text,                          -- their company / fund / institution
  segment text,                      -- ICP segment: coaching, clinic, real estate, tutoring...
  city text,
  email text,
  phone text,
  linkedin text,
  website text,
  why_them text,                     -- why this target, in one or two lines
  research text,                     -- the research brief the drafter works from
  status text not null default 'identified'
    check (status in ('identified', 'researched', 'drafted', 'sent', 'replied', 'meeting', 'won', 'lost', 'no_reply')),
  source text,                       -- where the target came from (manual, suggest, referral...)
  notes text,
  next_at timestamptz,               -- follow-up date; grant deadlines live here too
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists outreach_targets_set_updated_at on public.outreach_targets;
create trigger outreach_targets_set_updated_at
  before update on public.outreach_targets
  for each row execute function public.set_updated_at();

alter table public.outreach_targets enable row level security;
drop policy if exists "Allow all outreach_targets" on public.outreach_targets;
create policy "Allow all outreach_targets" on public.outreach_targets for all using (true) with check (true);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.outreach_targets(id) on delete cascade,
  direction text not null default 'out' check (direction in ('out', 'in')),
  channel text not null default 'email' check (channel in ('email', 'linkedin', 'whatsapp', 'call')),
  subject text,
  body text,
  gmail_draft_id text,               -- set when the draft lands in Gmail Drafts
  gmail_message_id text,
  gmail_thread_id text,
  sent_at timestamptz,               -- stamped when Z marks the target sent
  created_at timestamptz not null default now()
);

create index if not exists outreach_messages_target_idx on public.outreach_messages (target_id, created_at desc);

alter table public.outreach_messages enable row level security;
drop policy if exists "Allow all outreach_messages" on public.outreach_messages;
create policy "Allow all outreach_messages" on public.outreach_messages for all using (true) with check (true);

-- ── Seeds ──────────────────────────────────────────────────────────────
-- Citations: the AEO placement checklist. Each is a target to work through.
-- Guarded so re-running the migration never duplicates rows.

insert into public.outreach_targets (kind, name, org, website, why_them, source)
select 'citation', v.name, 'PROXe', v.website, v.why_them, 'seed'
from (values
  ('Product Hunt launch',        'https://www.producthunt.com',      'Launch day = backlink + the single most-cited SaaS discovery surface for AI answers.'),
  ('G2 profile',                 'https://www.g2.com',               'AI engines lean on G2 for "best X software" answers; reviews compound.'),
  ('Capterra listing',           'https://www.capterra.com',         'Gartner network (also GetApp + Software Advice from one submission).'),
  ('GetApp listing',             'https://www.getapp.com',           'Comes with Capterra; verify the listing renders properly.'),
  ('SaaSHub listing',            'https://www.saashub.com',          'Free, indexes fast, appears in alternatives queries.'),
  ('AlternativeTo listing',      'https://alternativeto.net',        'The "alternatives to X" surface AI engines quote directly.'),
  ('Crunchbase profile',         'https://www.crunchbase.com',       'Identity layer: AI engines resolve company facts from Crunchbase.'),
  ('Futurepedia listing',        'https://www.futurepedia.io',       'Largest AI-tools directory; PROXe is squarely an AI tool.'),
  ('There''s An AI For That',    'https://theresanaiforthat.com',    'High-traffic AI directory, cited in "AI for lead follow-up" answers.'),
  ('IndiaMART listing',          'https://www.indiamart.com',        'India business-listing surface; matches the India SMB ICP.'),
  ('LinkedIn company page',      'https://www.linkedin.com',         'Hygiene: complete page, product tab, weekly activity. AI engines read it.'),
  ('Google Business Profile',    'https://business.google.com',      'Grounds "PROXe Bangalore" queries; reviews feed AI local answers.'),
  ('Reddit presence r/SaaS',     'https://www.reddit.com/r/SaaS',    'Reddit is a top AI-answer source; genuine build-journey posts only, no spam.'),
  ('Reddit r/indianstartups',    'https://www.reddit.com/r/indianstartups', 'India founder surface; founding-20 story fits.'),
  ('Quora answer seeds',         'https://www.quora.com',            '5-8 genuine answers on WhatsApp lead-management questions, cited by AI engines.'),
  ('YourStory / Inc42 pitch',    'https://yourstory.com',            'India startup press; one profile piece = durable citation.'),
  ('Clutch profile',             'https://clutch.co',                'B2B services directory; also covers the BCON agency side.'),
  ('Trustpilot profile',         'https://www.trustpilot.com',       'Review surface AI engines quote for trust questions.')
) as v(name, website, why_them)
where not exists (
  select 1 from public.outreach_targets t where t.kind = 'citation' and t.name = v.name
);

-- Grants: known India programs. Deadlines change; verify before applying.
insert into public.outreach_targets (kind, name, org, website, why_them, source)
select 'grant', v.name, v.org, v.website, v.why_them, 'seed'
from (values
  ('Startup India Seed Fund Scheme', 'DPIIT',            'https://seedfund.startupindia.gov.in', 'Up to Rs 20L grant + Rs 50L convertible via incubators; PROXe fits SaaS criteria.'),
  ('MeitY TIDE 2.0',                 'MeitY',            'https://www.meity.gov.in',             'ICT-focused; grants via academic incubators (EiR + grant stages).'),
  ('NIDHI PRAYAS',                   'DST',              'https://nidhi.dst.gov.in',             'Prototype grant up to Rs 10L; early hardware/software prototyping.'),
  ('ELEVATE Karnataka',              'Govt of Karnataka','https://www.missionstartupkarnataka.org', 'Bangalore-registered startups; up to Rs 50L idea2PoC grant; annual call.'),
  ('Karnataka Startup Cell / KITS',  'Govt of Karnataka','https://www.missionstartupkarnataka.org', 'State registration + incentives; prerequisite for ELEVATE.')
) as v(name, org, website, why_them)
where not exists (
  select 1 from public.outreach_targets t where t.kind = 'grant' and t.name = v.name
);
