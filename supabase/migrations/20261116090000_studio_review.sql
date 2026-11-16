-- Studio Review: the team watches finished ads before they go live, and says
-- what they think. Studio -> Review -> brand -> product -> ad -> its cuts.
--
-- Files never live in Supabase. Review copies (720p) sit in Cloudflare R2 and are
-- played through short-lived signed links; once an ad is approved and live, its
-- 1080p master goes to Drive and the R2 copy is removed. Only rows live here.

create table if not exists public.review_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.studio_brands (id) on delete cascade,
  slug text not null,
  name text not null,
  notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  position int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table if not exists public.review_ads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.review_products (id) on delete cascade,
  code text not null,                          -- e.g. P03, C01, E-01
  title text not null,
  group_name text,                             -- ad set, e.g. "4. Cabin crew"
  note text,                                   -- what changed / what it waits on
  status text not null default 'review'
    check (status in ('review', 'waiting', 'blocked', 'approved', 'changes', 'live')),
  position int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, code)
);

create table if not exists public.review_files (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.review_ads (id) on delete cascade,
  variant text,                                -- e.g. "Devi voice", "Music 2"
  fmt text not null,                           -- 9x16 | 4x5 | 1x1
  kind text not null check (kind in ('video', 'image')),
  storage text not null default 'r2' check (storage in ('r2', 'drive', 'url')),
  path text not null,                          -- R2 key, Drive file id, or https URL
  bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists review_files_ad_idx on public.review_files (ad_id);

-- One score per person per ad (1 to 5), changeable.
create table if not exists public.review_ratings (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.review_ads (id) on delete cascade,
  reviewer text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_id, reviewer)
);

-- As many comments as people like, optionally pinned to a cut and a moment.
create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.review_ads (id) on delete cascade,
  file_id uuid references public.review_files (id) on delete set null,
  reviewer text not null,
  body text not null,
  at_seconds numeric,
  created_at timestamptz not null default now()
);
create index if not exists review_comments_ad_idx on public.review_comments (ad_id, created_at);

drop trigger if exists review_products_set_updated_at on public.review_products;
create trigger review_products_set_updated_at before update on public.review_products
  for each row execute function public.set_updated_at();
drop trigger if exists review_ads_set_updated_at on public.review_ads;
create trigger review_ads_set_updated_at before update on public.review_ads
  for each row execute function public.set_updated_at();
drop trigger if exists review_ratings_set_updated_at on public.review_ratings;
create trigger review_ratings_set_updated_at before update on public.review_ratings
  for each row execute function public.set_updated_at();

-- Server only (service role). No policies: the anon key reads nothing.
alter table public.review_products enable row level security;
alter table public.review_ads enable row level security;
alter table public.review_files enable row level security;
alter table public.review_ratings enable row level security;
alter table public.review_comments enable row level security;
