-- Studio: one place per brand for what we are making and why.
--
--   studio_brands  a brand we create for: mood, palette, brief, links
--   studio_items   everything on that brand's board:
--                    request  something the founder or team wants made (EDITR pulls these)
--                    idea     a concept worth making
--                    image    a still: GPT/ChatGPT render, upload, brand asset, frame from a cut
--                    note     a decision or a finding (claims risk, client feedback)
--
-- Reels stay in brand_reels and join on brand name. RLS on, no policies: service role only.

create table if not exists public.studio_brands (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  status      text not null default 'active' check (status in ('intake', 'active', 'paused', 'archived')),
  mood        text,                         -- one or two lines: the feeling we are going after
  palette     text[] not null default '{}', -- hex colours, brand first
  brief       text,                         -- markdown: what it is, audience, rules, risks
  site_url    text,
  instagram   text,
  drive_url   text,
  logo_path   text,                         -- storage path in bucket 'studio'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists studio_brands_set_updated_at on public.studio_brands;
create trigger studio_brands_set_updated_at before update on public.studio_brands
  for each row execute function public.set_updated_at();

create table if not exists public.studio_items (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.studio_brands (id) on delete cascade,
  kind        text not null check (kind in ('request', 'idea', 'image', 'note')),
  title       text,
  body        text,
  status      text not null default 'open'
    check (status in ('open', 'doing', 'done', 'approved', 'rejected', 'parked')),
  image_path  text,                         -- storage path in bucket 'studio'
  source      text,                         -- gpt | upload | asset | frame | editor
  prompt      text,                         -- the exact prompt, for images we generated
  tags        text[] not null default '{}',
  parent_id   uuid references public.studio_items (id) on delete set null,  -- image made for a request/idea
  created_by  text,                         -- 'team' or the agent name
  assignee    text,                         -- agent that took a request
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists studio_items_brand_idx on public.studio_items (brand_id, created_at desc);
create index if not exists studio_items_open_req_idx on public.studio_items (kind, status) where kind = 'request';

drop trigger if exists studio_items_set_updated_at on public.studio_items;
create trigger studio_items_set_updated_at before update on public.studio_items
  for each row execute function public.set_updated_at();

alter table public.studio_brands enable row level security;
alter table public.studio_items enable row level security;

insert into storage.buckets (id, name, public)
values ('studio', 'studio', false)
on conflict (id) do nothing;

-- Client share: a brand's board can be opened by a client through a secret link
-- (/studio/<slug>?k=<token>). They see mood, palette, ideas and images only (never
-- requests or notes, never anything marked hidden) and can like/pass and comment.
alter table public.studio_brands add column if not exists share_token text unique;
alter table public.studio_brands add column if not exists share_enabled boolean not null default false;
alter table public.studio_brands add column if not exists share_intro text;
alter table public.studio_items add column if not exists hidden boolean not null default false;

create table if not exists public.studio_votes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.studio_brands (id) on delete cascade,
  item_id uuid not null references public.studio_items (id) on delete cascade,
  voter text not null,                        -- the name the client typed
  choice text check (choice in ('like', 'pass')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, voter)
);
create index if not exists studio_votes_brand_idx on public.studio_votes (brand_id, created_at desc);
drop trigger if exists studio_votes_set_updated_at on public.studio_votes;
create trigger studio_votes_set_updated_at before update on public.studio_votes
  for each row execute function public.set_updated_at();
alter table public.studio_votes enable row level security;

-- Brand Reels orders (bconclub.com/brand-reels): the client board walks a reel
-- order through Concept -> Script -> Visual board -> Final reel.
--   idea   a reel concept (client chooses one); its images are the concept's stills
--   script the script for a concept (parent_id = the idea)
--   frame  one storyboard frame (parent_id = the idea, position = order, body = VO / on-screen line)
--   video  the final reel (image_path holds the video)
-- changes_allowed: the board changes included in the order (3 on the site).
alter table public.studio_items drop constraint if exists studio_items_kind_check;
alter table public.studio_items add constraint studio_items_kind_check
  check (kind in ('request', 'idea', 'image', 'note', 'script', 'frame', 'video'));
alter table public.studio_items add column if not exists position int;
alter table public.studio_brands add column if not exists reel_length text;   -- 30s | 60s | custom
alter table public.studio_brands add column if not exists changes_allowed int not null default 3;

-- A client's picks are a draft until they press "Send to BCON". sent_at is set on
-- send and cleared again whenever they change that pick, so ARC only ever acts on
-- what the client has actually sent.
alter table public.studio_votes add column if not exists sent_at timestamptz;
