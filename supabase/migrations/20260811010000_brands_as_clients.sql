-- ARC: make `brands` the client register on this database.
--
-- Context: this project's `brands` table was created from an early draft of the
-- dashboard migration and holds placeholder rows (BCON Club, PROXe, KOSH Studio,
-- OUCH! Piercing). None of them match the client names actually used on
-- projects/payments/proposals, so every money rollup reads zero.
--
-- This migration is ADDITIVE and NON-DESTRUCTIVE. It:
--   1. adds the client-register columns the rollups need
--   2. renames the one near-duplicate (KOSH Studio -> Kosh Studios)
--   3. inserts the real clients found in live data
--   4. backfills aliases so name variants resolve to one brand
--   5. links people to brands
--
-- It deletes nothing. BCON Club, PROXe and OUCH! Piercing are left in place, -- they are your own products rather than paying clients, so remove them by hand
-- if you don't want them on the Brands page.

-- ── 1. Client-register columns ──────────────────────────────

alter table public.brands add column if not exists aliases          text[];
alter table public.brands add column if not exists domains          text[];
alter table public.brands add column if not exists gstin            text;
alter table public.brands add column if not exists state_code       text;
alter table public.brands add column if not exists place_of_supply  text;
alter table public.brands add column if not exists country          text default 'IN';
alter table public.brands add column if not exists currency         text default 'INR';
alter table public.brands add column if not exists is_export        boolean default false;
alter table public.brands add column if not exists first_seen       date;
alter table public.brands add column if not exists last_seen        date;
alter table public.brands add column if not exists lifetime_revenue numeric default 0;

alter table public.people add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists brands_name_idx   on public.brands (name);
create index if not exists people_brand_idx  on public.people (brand_id);

-- The existing status check only allows on_track/at_risk/paused/archived.
-- Widen it so 'active' (used by the other database) is also valid.
do $$
begin
  alter table public.brands drop constraint if exists brands_status_check;
  alter table public.brands add constraint brands_status_check
    check (status in ('on_track', 'active', 'at_risk', 'paused', 'dormant', 'archived', 'lost'));
end $$;

-- ── 2. Fold the near-duplicate placeholder into the real client ──
-- "KOSH Studio" (seeded) and "Kosh Studios" (used on payments/projects) are the
-- same client. Renaming keeps the accent colour and any linked repos.

update public.brands set name = 'Kosh Studios'
  where lower(name) = 'kosh studio'
    and not exists (select 1 from public.brands b2 where lower(b2.name) = 'kosh studios');

-- ── 3. Insert the clients that appear in live data but have no brand row ──

insert into public.brands (name, status) values
  ('Laptop Store',                'on_track'),
  ('ISIVIS Group',                'on_track'),
  ('YV Homes',                    'on_track'),
  ('Turquoise',                   'on_track'),
  ('Jamaican Kitchen',            'on_track'),
  ('House of Concepts',           'on_track'),
  ('WOWBUS (Arvin Software LLP)', 'on_track'),
  ('Kosh Studios',                'on_track')
on conflict (name) do nothing;

-- ── 4. Aliases, every other spelling the same client is recorded under ──
-- Without these the rollups split one client across several names, or drop rows
-- entirely. Each value below was taken from a real string in this database.

update public.brands set
  aliases = array['Laptop Store India', 'Laptopstore', 'itel computer', 'Proago'],
  domains = array['laptopstoreindia.com']
  where name = 'Laptop Store';

update public.brands set
  aliases = array['ISVIS Group', 'Isivis Group', 'maison-isivis'],
  domains = array['isivisgroup.com']
  where name = 'ISIVIS Group';

update public.brands set
  aliases = array['Turquoise Holidays', 'Turquoise Ops']
  where name = 'Turquoise';

update public.brands set
  aliases = array['Arvin Software LLP', 'WOWBUS']
  where name = 'WOWBUS (Arvin Software LLP)';

update public.brands set
  aliases = array['KOSH Studio', 'Now Media', 'Now Media (Kosh Studios)']
  where name = 'Kosh Studios';

update public.brands set
  aliases = array['House of Concepts (Australia)'],
  domains = array['houseofconcepts.com.au']
  where name = 'House of Concepts';

update public.brands set domains = array['windchasers.in'] where name = 'WindChasers';
update public.brands set domains = array['yvhomes.in']     where name = 'YV Homes';

-- ── 5. Link people to brands ────────────────────────────────
-- Matches org against name and aliases, and splits compound orgs on "/" and ","
-- so "WindChasers / Turquoise" attaches to the first of the two that resolves.

update public.people p
set brand_id = b.id
from public.brands b
where p.brand_id is null
  and p.org is not null
  and exists (
    select 1
    from unnest(string_to_array(replace(p.org, ',', '/'), '/')) as part
    where lower(btrim(part)) = lower(b.name)
       or lower(btrim(part)) = any (select lower(a) from unnest(coalesce(b.aliases, '{}')) as a)
  );

-- ── 6. Tell PostgREST to reload, so the API sees the new columns immediately ──
NOTIFY pgrst, 'reload schema';
