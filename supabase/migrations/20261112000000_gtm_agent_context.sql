-- GTM sales playbook for agents, served at /api/agent/context?ns=gtm&format=md
-- One agent_context row (namespace 'gtm') rebuilt from arc_context whenever
-- sales_pain_model, gtm_learnings, gtm_handoff or gtm_brief changes, so agents
-- always read the latest from one link. Source of truth stays arc_context.

create or replace function public.sync_gtm_agent_context() returns void
language plpgsql security definer set search_path = public as $$
declare
  pain text; learn text; hand text; brief text; brief_md text;
begin
  select value into pain  from arc_context where key = 'sales_pain_model';
  select value into learn from arc_context where key = 'gtm_learnings';
  select value into hand  from arc_context where key = 'gtm_handoff';
  select value into brief from arc_context where key = 'gtm_brief';
  begin
    brief_md := jsonb_pretty(brief::jsonb);
  exception when others then
    brief_md := coalesce(brief, '');
  end;
  insert into agent_context (namespace, scope, payload, summary_md, source, fetched_at, expires_at, updated_at)
  values (
    'gtm', 'global',
    jsonb_build_object('keys', jsonb_build_array('sales_pain_model','gtm_learnings','gtm_handoff','gtm_brief')),
    'Read in this order. Never name TEMQ or VPP to a prospect.' || E'\n\n'
      || coalesce(pain, '') || E'\n\n---\n\n'
      || '# GTM brief (offer, buyer, channels, rules)' || E'\n\n```json\n' || brief_md || E'\n```\n\n---\n\n'
      || coalesce(hand, '') || E'\n\n---\n\n'
      || coalesce(learn, ''),
    'arc_context', now(), null, now()
  )
  on conflict (namespace, scope) do update
    set payload = excluded.payload, summary_md = excluded.summary_md, source = excluded.source,
        fetched_at = now(), updated_at = now();
end $$;

create or replace function public.trg_sync_gtm_agent_context() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.key in ('sales_pain_model','gtm_learnings','gtm_handoff','gtm_brief') then
    perform public.sync_gtm_agent_context();
  end if;
  return new;
end $$;

drop trigger if exists arc_context_sync_gtm on public.arc_context;
create trigger arc_context_sync_gtm
  after insert or update on public.arc_context
  for each row execute function public.trg_sync_gtm_agent_context();

select public.sync_gtm_agent_context();
