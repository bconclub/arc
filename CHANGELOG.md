# Changelog

## 2026-06-05 05:03 IST · fix sidebar invisible in light mode

- **Sidebar (`Sidebar.tsx`):** the logo, version badge, BCON Club label, nav text, active pill, and borders were hardcoded `text-white` / `bg-white` / white-tinted — so in light mode the whole panel vanished (white-on-white). Swapped all to theme tokens: text→`text-text`, active pill→`bg-text text-bg` (inverts per theme), borders→`var(--border)`, hovers→`var(--glow-white)`. Verified in light mode: "ARC" and "BCON Club" render `rgb(26,26,26)` on the `rgb(247,247,248)` background.
- **TopBar (`TopBar.tsx`):** border + import/export hovers themed; replaced the stale white "K" box mobile logo with a plain themed "ARC" wordmark.
- **ThemeToggle (`ThemeToggle.tsx`):** hover bg themed.
- User-facing: the left panel and top bar are now fully visible and correct in both light and dark mode.
- (`3807c20`)

## 2026-06-05 03:26 IST · one-click light/dark theme toggle (whole UI)

- **Theme system (`globals.css`):** added a full set of semantic CSS variables (card/heading/body/faint/thumb/chip/drawer/overlay) plus a `[data-theme="light"]` override that re-maps every token, so flipping the attribute restyles the entire app.
- **Toggle (`ThemeToggle.tsx`, `TopBar.tsx`):** new sun/moon button in the top-right — one click switches light↔dark, persists to `localStorage('arc:theme')`.
- **No-flash (`layout.tsx`):** a tiny blocking script applies the saved theme to `<html data-theme>` before first paint.
- **Feed page (`dashboard/feed/page.tsx`):** converted ~50 hardcoded inline colors (cards, header, chips, skeleton, reading drawer, empty states) to the theme variables so the feed — not just the chrome — flips with the toggle. Score-badge accent colors (orange/green) intentionally kept.
- User-facing: a light/dark switch top-right; one click changes the whole UI and the choice sticks across reloads.
- (`d4430f6`)

## 2026-06-05 03:20 IST · fix BCON icon clipping in collapsed sidebar

- **Sidebar (`Sidebar.tsx`):** the brand row had double padding (outer `px-3` + inner `px-2` = 40px) which, on the 64px collapsed rail, left only 24px for a 32px icon — so `overflow:hidden` clipped it (only a sliver showed). Shrunk the icon to 28px, flattened the label into a single truncating `<p>`, and added `overflow-hidden` on the row. Verified via DOM measurement: icon now sits left:20→right:43, fully inside the 0–64 rail.
- (`2fdc7b8`)

## 2026-06-05 03:06 IST · richer card excerpts + curated marketing RSS sources

- **Curated marketing RSS sources:** verified (200 OK + items) and added a strong set of marketing/AI/business feeds — India (Inc42, ET BrandEquity, YourStory Marketing) and global (HubSpot, Search Engine Land, Search Engine Journal, Neil Patel, Seth Godin, Adweek, Buffer, Marketing Week, MarTech, Social Media Today) plus AI/tech (VentureBeat AI, MIT Tech Review, TechCrunch, Hacker News). Inserted the 12 new ones into the live `sources` table (now 18 active) and updated both the `apply_all.sql` seed and the Sources-page self-heal defaults so fresh installs get them. Dead/blocked feeds (Storyboard18, Exchange4media, Convince&Convert, MarketingProfs) were tested and excluded.
- **Richer card excerpts (`api/fetch-rss/route.ts`, `dashboard/feed/page.tsx`):** snippet length lifted 300→500 chars and whitespace-cleaned; feed cards now show a 3-line excerpt (was 2) with a hover tooltip for the full text — enough to size up an article before opening it.
- User-facing: feed is now marketing/AI-dense from many sources, and each card gives a real preview of what the article is about.
- (`67c6143`)

## 2026-06-05 03:01 IST · BCON brand, rigorous keyword filtering, ICP ranking, logo fallback

- **Sidebar (`Sidebar.tsx`, `public/bcon-icon.png`):** replaced the "User / Free Plan" block with the **BCON Club** brand + its icon (copied from the bconclub repo). Removed the unused user hook.
- **Rigorous keyword filtering (`dashboard/feed/page.tsx`):** selecting a topic chip now filters the loaded signals **client-side and strictly** — every word in the keyword must appear in the story (title + snippet + source). "AI agents" → only stories containing both "ai" AND "agents". Whole-word match (so "ai" won't match "rain"). Header shows "N of M match", with a dedicated empty-state when nothing matches. Filtering no longer refetches, so it's instant.
- **Keyword persistence:** topic chips already persist in localStorage and now stay until explicitly removed (filtering no longer triggers refetches that could reset them). Default chips simplified to clean keywords ("Marketing", "AI").
- **ICP relevance ranking (`api/ai/route.ts`):** feed now blends recency with a relevance boost for our focus areas (marketing/brand/SEO/content, AI/LLM/agents/automation, startup/SaaS/B2B/SMB) and demotes off-topic finance/crypto/stock items, so business-marketing-AI stories rank at the top.
- **Source-logo image fallback (`dashboard/feed/page.tsx`):** cards with no article image (or a broken image) now show the source's logo + name as a clean branded placeholder instead of a faint icon.
- User-facing: BCON Club branding in the sidebar; keyword chips filter strictly and stick; top of feed is marketing/AI/business-relevant; every card shows either an image or its source logo.
- (`ec56c3a`)

## 2026-06-05 02:52 IST · OpenGraph image fallback (near-full feed image coverage)

- **`api/fetch-rss/route.ts`:** for items with no image in their RSS, now fetches the article page and reads its `og:image` / `twitter:image` meta tag. Capped at 6 concurrent requests with a 4s timeout each and a 50KB head-only read, so the feed stays fast. Lifted image coverage from 10/30 to **28/30** — TechCrunch 0→10/10, Hacker News 0→8/10, Inc42 10/10. Remaining misses are pages with genuinely no og:image (e.g. arXiv).
- User-facing: nearly every feed card now shows a real article image instead of a favicon placeholder.
- (`997516d`)

## 2026-06-05 02:41 IST · feed images from RSS content + full-heading tooltip

- **RSS image extraction (`api/fetch-rss/route.ts`):** added `customFields` for `content:encoded` / `media:content` / `media:thumbnail`, and a fallback that pulls the first real `<img>` out of the article HTML (skips tracking pixels). Image-rich feeds like Inc42 now return 10/10 images instead of 0. Note: TechCrunch and Hacker News publish no images in their RSS, so those still fall back to the source favicon.
- **Feed headings (`dashboard/feed/page.tsx`):** added a `title` attribute on the card `<h3>` so hovering a clamped (2-line) heading shows the full text as a native tooltip — no more guessing at cut-off titles.
- User-facing: feed cards now show article images where the source provides them, and full headings on hover.
- (`78eaa8d`)

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
