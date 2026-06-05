# Changelog

## 2026-06-05 02:37 IST · sidebar logo: restore version badge (icon stays removed)

- **Sidebar (`Sidebar.tsx`):** put the version badge back — header now reads "ARC v0.0.3". The icon image was already removed earlier; only the text + badge remain (reverts the prior badge-removal, which was a misread of the request).
- (`e5d40b5`)

## 2026-06-05 02:32 IST · sidebar logo: just "ARC"

- **Sidebar (`Sidebar.tsx`):** removed the version badge (`v0.0.3`) next to the logo — the sidebar header now shows only the word "ARC". Dropped the now-unused `VERSION` import.
- (`2103ad8`)

## 2026-06-05 02:30 IST · sidebar hover-to-expand + text-only logo

- **Sidebar (`globals.css`, `Sidebar.tsx`, `dashboard/layout.tsx`):** restored the Supabase/Vercel-style collapsed icon rail (64px) that expands to 220px on hover and auto-collapses on mouse-out. Nav labels, version badge, and user name/plan fade in on hover and hide when collapsed. Main content margin set to the collapsed 64px (rail overlays content on hover instead of pushing it).
- **Logo:** removed the `/ARC.png` image entirely — the sidebar now shows text-only "ARC" + version badge. Dropped the unused `next/image` import.
- User-facing: left panel is now a clean icon rail that opens on hover, just the word "ARC" as the logo.
- (`8d1b652`)

## 2026-06-05 02:20 IST · reset DB to ARC schema (feed live end-to-end)

- **New `supabase/01_drop_old_tables.sql`:** destructive, run-once script that drops the 16 stale tables that were occupying ARC's Supabase project (they were an unrelated CRM dataset — leads, conversations, sessions, knowledge_base). Cleared the project so it can be used for ARC.
- **Rewrote `supabase/apply_all.sql`:** now creates exactly the 6 tables the app uses — `sources`, `signals`, `arc_context`, `saved_signals`, `voice_templates`, and the newly-added **`inspiration_posts`** (Voice page reads/writes it for voice extraction). Fixed `arc_context.value` to **`text`** (was `jsonb`) to match what `lib/context.ts` and the AI route actually write. Permissive single-user RLS on all six. Seeds 6 bot-accessible RSS sources + default context rows.
- **Verified end-to-end:** after running both scripts, the live DB shows all 6 ARC tables (sources=6, arc_context=4 seeded) and the old tables gone. The feed endpoint now returns **30 live signals** (TechCrunch, Hacker News, Inc42) — the core empty-feed blocker is resolved.
- User-facing: the Feed page now populates with real articles instead of showing nothing.
- (`c497a8b`)

## 2026-05-31 21:07 IST · fix sidebar layout + repair sources/feed backend wiring

- **Sidebar (`globals.css`, `dashboard/layout.tsx`):** dropped the hover-to-expand collapse behaviour that left the rail in a broken half-state (clipped logo, hidden nav labels, mangled user block). The sidebar is now a fixed 220px always-expanded rail; main content margin bumped `200px → 220px` to match. User-facing: left panel top (logo/nav) and bottom (user profile) render correctly again.
- **Sources page (`dashboard/sources/page.tsx`):** self-heal seeding now triggers when *no RSS source* exists (not only when the whole table is empty), and the default RSS set was curated to bot-accessible 200-OK feeds (replaced dead/blocked YourStory, Marketing Brew, Product Hunt).
- **Diagnosis — empty feed root cause:** traced to the backend, not the UI. `.env.local` shipped with placeholder Supabase credentials (`your-project.supabase.co` → `ENOTFOUND`); after real creds were restored, the live Supabase project was reachable but **had no tables** (`Could not find the table 'public.sources'`). The schema was never applied.
- **New `supabase/apply_all.sql`:** one idempotent, re-runnable script that creates every table the app touches (`sources`, `signals`, `arc_context`, `saved_signals`, `voice_templates`), adds the columns the code writes that the original migrations lacked (`signals.source_type/favicon`, `saved_signals.score/excerpt/favicon_url/published_at`), applies permissive single-user RLS, and seeds default sources + context. Run it in Supabase → SQL Editor to light up the feed.
- Local `ANTHROPIC_API_KEY` wired into `.env.local` (was a placeholder) so AI write/voice features work in dev. No secrets committed — env files are gitignored.
- Also includes prior in-progress work on the AI route, fetch-rss, voice, and write pages.
- (`0ebd2c2`)
