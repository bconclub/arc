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
