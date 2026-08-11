-- ARC: classify brands, and record work that arrives through an agency.
--
-- Not every row in `brands` is someone who pays you. Now Media and Proago route
-- or deliver work but are never invoiced; Axlrate R&I is a prospect; BCON Club,
-- PROXe and OUCH! Piercing are your own products. Treating all of them as
-- clients made the Brands page read as though six accounts owed nothing.
--
-- The vocabulary matches the values already used in people.relation
-- (client / partner / prospect), plus 'agency' and 'own'.
--
-- Additive and non-destructive: no rows are deleted.

-- ── 1. Columns ──────────────────────────────────────────────

alter table public.brands add column if not exists kind text not null default 'client';
alter table public.brands add column if not exists via_brand_id uuid references public.brands(id) on delete set null;

do $$
begin
  alter table public.brands drop constraint if exists brands_kind_check;
  alter table public.brands add constraint brands_kind_check
    check (kind in ('client', 'agency', 'partner', 'prospect', 'own'));
end $$;

create index if not exists brands_kind_idx on public.brands (kind);
create index if not exists brands_via_idx  on public.brands (via_brand_id);

-- ── 2. The non-client rows that already exist ───────────────

update public.brands set kind = 'own'
  where name in ('BCON Club', 'PROXe', 'OUCH! Piercing');

-- ── 3. Entities that were wrongly folded in as aliases ──────
-- Now Media is the agency behind Kosh Studios, not another spelling of it.
-- Proago is a delivery partner on Laptop Store work, not a Laptop Store alias.
-- Both were absorbed by the previous migration; separate them again.

update public.brands
  set aliases = array['KOSH Studio']
  where name = 'Kosh Studios';

update public.brands
  set aliases = array['Laptop Store India', 'Laptopstore', 'itel computer']
  where name = 'Laptop Store';

insert into public.brands (name, kind, status, aliases) values
  ('Now Media',   'agency',   'on_track', array['Now Media (Kosh Studios)']),
  ('Proago',      'partner',  'on_track', array['proago.in']),
  ('Axlrate R&I', 'prospect', 'on_track', array['Axlrate'])
on conflict (name) do nothing;

update public.brands set kind = 'agency'   where name = 'Now Media';
update public.brands set kind = 'partner'  where name = 'Proago';
update public.brands set kind = 'prospect' where name = 'Axlrate R&I';

-- ── 4. Kosh Studios is invoiced directly, but arrives via Now Media ──
-- It stays kind='client' because it is the name on the invoice.

update public.brands k
  set via_brand_id = n.id
  from public.brands n
  where k.name = 'Kosh Studios' and n.name = 'Now Media';

-- ── 5. Re-point contacts at the entity they actually belong to ──
-- Nithin and Afnan are Now Media; Shibu and Jacob are Proago; Alia is Axlrate.
-- The dashboard still surfaces them on related brands via org-text matching.

update public.people p set brand_id = b.id
  from public.brands b
  where b.name = 'Now Media' and p.org ilike 'Now Media%';

update public.people p set brand_id = b.id
  from public.brands b
  where b.name = 'Proago' and p.org ilike 'Proago%';

update public.people p set brand_id = b.id
  from public.brands b
  where b.name = 'Axlrate R&I' and p.org ilike 'Axlrate%';

NOTIFY pgrst, 'reload schema';
