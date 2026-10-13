-- Per-person access: which parts of ARC a team login may open.
-- Areas are keys defined in src/lib/access.ts ("studio", "sales"). New people get
-- Studio by default; the people already here were added as sales, so they keep that.
alter table team_members add column if not exists access text[] not null default '{studio}';
update team_members set access = '{sales}' where role = 'sales' and access = '{studio}';

-- role was sales-only; it now mirrors access ("sales" when they have Sales, else "studio").
alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check check (role in ('sales','studio'));
