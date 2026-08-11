-- ============================================================
-- ⚠️  DESTRUCTIVE, run ONLY in the project you intend to wipe.
-- Confirm the top breadcrumb reads:  BCON Club / ARC / PRODUCTION
-- This permanently deletes all 16 existing tables and their data.
-- ============================================================

drop table if exists public.activities             cascade;
drop table if exists public.all_leads              cascade;
drop table if exists public.conversations          cascade;
drop table if exists public.dashboard_settings     cascade;
drop table if exists public.dashboard_users        cascade;
drop table if exists public.knowledge_base_chunks  cascade;
drop table if exists public.knowledge_base         cascade;
drop table if exists public.lead_stage_changes     cascade;
drop table if exists public.lead_stage_overrides   cascade;
drop table if exists public.social_sessions        cascade;
drop table if exists public.stage_history          cascade;
drop table if exists public.unified_leads          cascade;
drop table if exists public.user_invitations       cascade;
drop table if exists public.voice_sessions         cascade;
drop table if exists public.web_sessions           cascade;
drop table if exists public.whatsapp_sessions      cascade;

-- Verify nothing remains in public:
--   select tablename from pg_tables where schemaname = 'public' order by 1;
