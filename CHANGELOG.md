# Changelog

## 2026-07-23 17:55 IST · fix: native dropdowns unreadable in dark mode

- `color-scheme: dark` on `:root` (+ `light` under `[data-theme="light"]`) so native form controls — select popups, date-picker calendars, scrollbars — follow the app theme instead of the OS default.
- Explicit `select option { background: var(--surface); color: var(--text) }` fallback for Chromium builds that ignore color-scheme on option backgrounds.
- User-facing: status/size/platform dropdown options were white-on-white in dark mode (invisible); now themed. Date inputs get a matching dark calendar icon.
- `(pending)`

## 2026-07-23 · ARC becomes the twin: Operations module + Brand module + password gate + pet

- **ARC is now the master system** — three pillars in the sidebar: **Operations · Content · Brand**. The LUKO operations dashboard (previously a standalone Next 16 app at `Builds/Luko/webapp`, now deprecated) was ported in as the Operations module.
- **Operations (`/dashboard/ops/*`):** Today overview (overdue/next-3-days attention list from project tasks + focus list, waiting-on-others, money out, proposals in play, unseen high/critical alerts), Projects (tiles with timeline start→end, size S–XL, budget ₹, progress bar, tasks checklist; full modal CRUD), People, Proposals, Money (with overdue/pending/paid stat cards), Alerts (severity inbox, mark seen). API under `/api/ops/*` on `supabaseAdmin`.
- **Brand (`/dashboard/brand/*`):** Metrics — manual per-platform snapshots (followers/reach/engagement, one row per platform+day, upsert) with deltas + inline-SVG sparkline, no chart lib. Calendar — `content_plan` pipeline board (idea→draft→scheduled→posted) as a thin planning overlay; "Pull from ARC" imports agent `ideas`, rows can link to `posts`. Content source of truth stays in the agent tables.
- **Password gate:** `src/middleware.ts` (Edge-safe: Web Crypto only, no Buffer) + `/login` + PBKDF2(210k)+HMAC session cookie (`arc_session`, 30d). Everything protected except `/login`, `/api/login`, static assets, and `/api/arc/sync` + `/api/arc/cron` (Vercel cron unaffected; still has optional `CRON_SECRET`). New env vars `SESSION_SECRET` + `DASHBOARD_PASSWORD_HASH` (generate: `node scripts/hash-password.mjs "pass"`); local temp password is `arc` — change it.
- **ARC pet (`src/components/Pet.tsx`):** pixel-sprite corner companion on every dashboard page. States from `/api/ops/pet-state`: **on fire** (overdue payment / unseen critical alert), **alert** (overdue tasks / high alert), **happy** (open work, all on track), **sleeping** (nothing open). Click → Ops Today. Pure SVG rects, blink + fire flicker, `motion-reduce` safe.
- **DB migration `supabase/migrations/20260723000000_twin_ops_brand.sql`** (+ appended to `apply_all.sql`): `projects`, `people`, `proposals`, `payments`, `now_tasks`, `ops_signals` (renamed — `signals` was taken by the RSS cache), `brand_metrics`, `content_plan` (FKs to `ideas`/`posts`). Permissive single-user RLS, same pattern as the content tables. **Must be run in the Supabase SQL editor** — REST can't do DDL.
- Verified locally: gate blocks/admits correctly (curl cookie-jar + browser), cron bypasses, all new pages render in ARC's shell, Feed/Write/ARC Agent unaffected, `npm run build` clean.

## 2026-06-20 23:25 IST · Idea engine + token-cost Config page + prod Supabase fix

- **Fixed the production root cause:** Vercel's `NEXT_PUBLIC_SUPABASE_URL` pointed at the dead old project (`zboanatspldypfrtrkfp` → NXDOMAIN → "fetch failed", every API 500). Updated it to `niypveotxuledkrcikun`. (The 2 JWT keys still need swapping by the user — I can't enter API tokens.)
- **Created the 3 missing content tables** (`voice_templates`, `inspiration_posts`, `saved_signals`) via the Supabase SQL editor — Style/Write/save features now have their backing tables.
- **Idea engine (`src/lib/arc/ideas.ts`, `/api/arc/ideas/generate`):** the ARC Agent page now generates the top ~8 content ideas from the live feed via a cheap Haiku call, scored against BCON fit, each with a hook/angle/rationale. "Generate Top Ideas" button (manual) + auto-generation on every feed sync. Each idea has a **Write this** button → opens the Write engine pre-loaded with the angle. Replaces the dead "run arc run on VPS" empty state.
- **Token-cost tracking (`src/lib/arc/usage.ts`):** every Claude call (write-post, web-search, analyze-style, generate-ideas) records input/output tokens + estimated USD into `arc_context` — no new table.
- **New Config page (`/dashboard/config`):** total tokens, estimated cost, breakdown by model + action, and system status (sources, cached signals, approval gate, models). Reset button. Added "Config" to the sidebar.
- Verified locally end-to-end: generated 8 on-brand ideas (top score 95) for $0.0061; Config shows the spend live. (`4141108`)

## 2026-06-20 22:40 IST · Feed engine: 21 sources, in-process RSS, autowire sync

- **Seeded 21 verified RSS sources** into Supabase `sources` (deep-research + live-verified, June 2026): India startup (Inc42, YourStory), marketing (HubSpot, Neil Patel, Buffer, Sprout Social, MarTech Series, Social Media Examiner), SEO (Ahrefs, Moz, Search Engine Journal), AI/tech (VentureBeat AI, MIT Tech Review, TechCrunch, Ben's Bites), creator economy (Fast Company, ICYMI, Simon Owens, Next in Media), B2B SaaS (SaaStr). Recorded in `supabase/seed_sources.sql`.
- **Fixed the silent cache failure** (root cause of the `/api/ai` 500s in prod logs): the `signals` table has no `fetched_at`/`source_type`/`favicon` columns, so every cache write was failing and every feed open did a slow full fetch. Cache now keys freshness on `created_at` and writes only existing columns. No DDL required.
- **New shared RSS engine (`src/lib/arc/rss.ts`):** parse/score/cache feeds **in-process** — removes the internal `/api/fetch-rss` HTTP hop that Vercel deployment protection would block. `fetchFeeds`, `itemsToSignals`, `readSignalsCache`, `writeSignalsCache`.
- **Autowire sync (`/api/arc/sync` + Vercel cron):** new route rewrites the signal cache from all active sources; `vercel.json` cron runs it daily (01:00 UTC). On-open refresh (2h cache) covers freshness during use. User-facing: Feed now loads instantly from cache and stays current automatically.
- **Refactored `/api/ai` and `/api/fetch-rss`** to use the shared engine; dropped ~230 lines of duplicated/broken helpers.
- Verified locally end-to-end: sync → 21 sources → 267 items → 150 cached; feed reads cache in 0.5s. (`1d702c5`)

## 2026-06-16 13:15 IST · OpenRouter client + credentials

- **OpenRouter integration (`src/lib/openrouter.ts`):** server-side client giving ARC one gateway to many models (`openai/*`, `anthropic/*`, `google/*`…). `openrouterChat()` (non-streaming) + `openrouterStream()` (SSE), model overridable per call, with sensible defaults (`OPENROUTER_MODELS.smart = anthropic/claude-sonnet-4.6`, verified valid on OpenRouter).
- **Credentials:** `OPENROUTER_API_KEY` added to `.env.local` (gitignored — key never committed). Verified live against the OpenRouter API (returned "ARC ok"). For production, add `OPENROUTER_API_KEY` (and optional `NEXT_PUBLIC_SITE_URL` for the referer header) to Vercel env.
- **Docs:** `arc.md` env section updated with the full var list + OpenRouter usage note.
- (`c74724a`)

## 2026-06-16 12:14 IST · ARC OS: Outreach lane + Market watch + focused lanes

- **Scoped the OS to what we run now:** Outreach, Content, Market (industry). Dropped Delivery/Build from the model (`types/os.ts` Lane = outreach | content | market). Today's needs reseeded to these three; every need now routes to a real destination (content→Write, outreach→Outreach, market→Feed).
- **New Outreach lane (`dashboard/outreach`, `lib/os-outreach.ts`):** the full "who to reach, what to pitch, the plan" screen. Three tabs:
  - **Leads** — fit-scored lead list (India + US), region + stage filters, stage badges, why-now per lead. 8 seed leads.
  - **Plan** — region playbooks (India WhatsApp-first, US email+LinkedIn) with concrete steps + daily targets.
  - **Products** — PROXe + BCON pitch cards.
  - **AI draft per lead** (new `draft-outreach` action): writes a personalized message in the founder voice for the lead's channel + chosen product + type (first touch / follow up / re-engage). Verified live: produced an on-brand, personalized WhatsApp DM. Copy/redraft.
- **Market watch in Pulse:** new top section "What the market is doing" — industry items tagged competitor/trend/regulation/opportunity, each with a "so what for us" line. This is the industry-feed pillar.
- **No-em-dash guarantee:** both write-post (streaming) and draft-outreach now strip em/en dashes server-side, so the style rule holds even when the model slips.
- Nav: added **Outreach** (Send icon, 3rd). All stubbed where noted; drafts are real AI.
- (`7592b5c`)

## 2026-06-16 10:05 IST · ARC OS: Pulse analytics hub (v1, stubbed)

- **New Pulse screen (`dashboard/pulse`)** — the "see the whole business" half of the OS. Three sections in one view: Content (posts/reach/replies/top post), Meta Ads (spend/leads/cost-per-lead/ROAS + a per-campaign table), and Site behaviour via Microsoft Clarity (sessions/scroll depth/dead+rage clicks + a top-pages table). Metric cards have up/down delta pills; tables are color-coded (ROAS, low scroll depth, high dead clicks).
- **`lib/os-analytics.ts`:** data shaped to mirror the real APIs (Clarity Data Export + Meta Marketing API / the live MCP), so swapping stub → live is a data-source change only. Every section is honestly badged "stub".
- This grounds the decide-brain: once wired, Today's ranked needs will reason over these real numbers (e.g. scroll depth drop → a content need).
- Nav: added **Pulse** (Activity icon, 2nd). Checkpoint commit, not pushed.
- (`e7290f3`)

## 2026-06-16 10:02 IST · ARC OS: Today screen (business command center, v1)

- **New direction — ARC as the business OS.** First screen of the loop Goals → Needs → Plays → Work → Results. Built the **Today** front door (`dashboard/today`): a goals strip (live progress) + a ranked "what the business needs" list across four lanes (Outreach, Content, Delivery, Build), each need carrying a grounded *why*, effort, and priority.
- **Approve / dismiss flow** logged to `arc:os:log` (localStorage) — this interaction log is the training data that lets a lane eventually run autonomously. Content needs route into the real Write engine; other lanes are stubbed pending their own engines.
- **`types/os.ts` + `lib/os-decide.ts`:** the Need/Goal/Lane/Interaction model and a stubbed "decide" brain (seed needs, ranked). Shape is final; only the source swaps stub → real (Clarity + Meta Ads + lead data) later.
- Nav: added **Today** (first item, Sparkles icon); dashboard root now redirects to Today. Everything else (Feed/Write/Style…) untouched, additive only.
- Stubbed by design; nothing connected yet. A checkpoint commit, not pushed.
- (`a971def`)

## 2026-06-05 13:08 IST · real identity + full style guide wired everywhere

- **Expanded "Who we are" (`style/page.tsx`, `lib/context.ts`, `apply_all.sql`):** replaced the one-liner with the real founder identity — Thanzeel Ashruf, PROXe (goproxe.com) + BCON Club (bconclub.com), 7 years in marketing, the done-for-you (PROXe) vs build-your-own (BCON) positioning, and the ICP.
- **Real style guide (`arc_context.voice_style`):** wrote the full VOICE / STRUCTURE / RULES guide to the live DB (lowercase first person, vulnerable, hook on a quietly-accepted problem, **never use em dashes**, no AI buzzwords, story-led, end with CTA/question, plus the PROXe punchline and recurring themes). Updated the SQL seed + code default so fresh installs match.
- **write-post rewritten (`api/ai/route.ts`):** now writes AS the founder, treating the style guide as source of truth, with hard rules enforced (lowercase, no em dashes, no buzzwords, hook-first). Verified: generated a LinkedIn post in the exact voice with 0 em dashes.
- User-facing: Style page shows the real identity + guide; Write now produces genuinely on-brand posts.
- (`1ff9829`)

## 2026-06-05 05:44 IST · fix article click-through in reading drawer

- **Root cause:** the reading drawer (`position:fixed`) was nested inside the page's `animate-fade-in` wrapper, whose lingering `transform` created a containing block — so the drawer grew to ~10,000px tall and its footer ("Open Original") rendered 10,000px off-screen, completely unreachable. That's why there was no visible way to open the article.
- **Fix (`dashboard/feed/page.tsx`):** render the drawer via `createPortal` into `document.body`, escaping the transformed ancestor. Drawer is now exactly viewport height (verified 859px) with the footer pinned on-screen.
- **Added an always-visible "Read full article ↗" link** next to the source name at the top of the drawer, so click-through is obvious and never depends on the footer being in view. Also added `flexShrink:0` + `minHeight:0` so content scrolls and the footer stays put.
- User-facing: opening a feed card now clearly shows how to read the full article — a link up top plus the Open Original button at the bottom.
- (`3068322`)

## 2026-06-05 05:35 IST · Voice → Style: learning style engine with diff approval

- **Renamed Voice → Style** (`/dashboard/voice` → `/dashboard/style`, nav label, palette icon instead of audio). It's about tone/how we write, not audio.
- **Hardcoded identity:** the page shows who we are (Thanzeel/PROXe/BCON, ICP) as read-only — no editing, no "regenerate brain prompt" button.
- **Learning loop (`api/ai/route.ts` new actions `analyze-style` + `save-style-guide`):** paste a post you like OR upload a screenshot → Claude (vision) extracts the text, auto-detects LinkedIn/Twitter, names the pattern, and proposes how to ENHANCE the existing style guide as a structured **diff** (add/modify cards). You Accept all, reject individual changes, or Discard — nothing changes until approved. Approved guide saves to `arc_context.voice_style`, which `write-post` already reads, so improving Style instantly improves writing.
- **Critical model fix (`api/ai/route.ts`, `lib/ai-client.ts`):** the app hardcoded `claude-sonnet-4-5-20251001`, which is **retired** (`not_found_error`) — this was silently breaking ALL AI calls (write, analyze, brain prompt). Updated to `claude-sonnet-4-6` (verified against the live model list).
- **Anthropic client hardening:** strip inherited `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_CUSTOM_HEADERS` and pin `baseURL` to the public API, so the SDK always uses our real `x-api-key` (some runtimes inject an OAuth token that caused 401 "Invalid bearer token").
- Verified end-to-end: analyze (LinkedIn post → pattern + 4-change diff), apply, and persist to the DB all work.
- (`db3a814`)

## 2026-06-05 05:09 IST · whole-word keyword matching + bigger signal pool

- **Whole-word filtering (`dashboard/feed/page.tsx`):** the keyword filter matched word *prefixes*, so "AI marketing" wrongly matched a DGCA airport story ("**ai**rports") and any "...marketing" fragment. Changed the regex from `\bTOKEN` to `\bTOKEN\b` (boundaries on both sides). Now "ai" matches "AI", "AI.", "(AI)" but NOT "airports". Verified: the DGCA story is in the pool but no longer matches "ai marketing".
- **Bigger signal pool (`api/ai/route.ts`, `api/fetch-rss/route.ts`):** the feed capped at 30 signals, so filtering could only ever search 30 items even with 18 sources. Raised the pool to 150 (cache read + final slice), and the per-feed item cap 10→15. A fresh fetch now returns 150 signals across all 18 sources, so keyword filters surface far more relevant content.
- **Feed streaming (`dashboard/feed/page.tsx`):** stagger-reveal the first 24 cards for the nice effect, then reveal the rest instantly — so a 150-item pool doesn't animate for 15s.
- User-facing: keyword filters are now precise (no fragment false-positives) and pull from a much deeper pool.
- (`85d3d16`)

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
