-- ARC: let a signal record HOW it was resolved, not just that it was.
--
-- `ops_signals` only had `seen`, a boolean. Marking something solved therefore
-- threw away the one thing worth keeping: what was actually done about it. The
-- next time the same alert fires there is nothing to look back at.
--
-- Additive and idempotent.

alter table public.ops_signals
  add column if not exists resolution text,
  add column if not exists resolved_at timestamptz;

comment on column public.ops_signals.resolution is
  'What was done about this signal, in plain words. Kept after resolution so a
   recurring alert can be read against how it was handled last time.';

comment on column public.ops_signals.resolved_at is
  'When it was marked solved. Null while open. Distinct from `seen`, which only
   means someone looked at it.';

create index if not exists ops_signals_resolved_at_idx on public.ops_signals (resolved_at);

-- Rows already marked seen predate this column, so their resolution is genuinely
-- unknown. Left null rather than backfilled with a guess.

NOTIFY pgrst, 'reload schema';
