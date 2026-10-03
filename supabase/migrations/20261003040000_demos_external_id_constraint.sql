-- Upserts on demos.external_id need a real unique constraint: PostgREST's
-- on_conflict cannot target a partial unique index. A plain unique
-- constraint still allows any number of NULLs, so manual demos are fine.
drop index if exists public.demos_external_id_key;
alter table public.demos drop constraint if exists demos_external_id_unique;
alter table public.demos add constraint demos_external_id_unique unique (external_id);
notify pgrst, 'reload schema';
