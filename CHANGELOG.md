# Changelog

Each entry's version is an annotated git tag: `git show v0.0.13`.

## 2026-08-12 06:20 IST · v0.0.17 — radar ranked by severity

- **Radar is ranked, not just recent.** Sorting by time alone put a fresh trivial warning above yesterday's critical, which is backwards for a panel whose job is to say what needs attention. Severity now dominates and recency breaks ties within a severity.
- Each row carries its **priority score**, so the ordering is visible rather than implied. Hovering explains how it was reached.
- The decay has a floor, deliberately. A 30-day-old critical still scores 50 and outranks a warning raised a minute ago at 30: an unresolved critical does not become less critical by being ignored for a month.
- **Resolved signals leave the radar entirely.** A radar showing things already dealt with teaches you to stop reading it. They remain on the alerts page and in the activity feed.
- Only the **top six** are shown, with a count of the rest. Past that it stops being something you scan and becomes something you skip.
- Informational signals no longer appear on the radar at all. They were never actionable and were crowding out things that are.

## 2026-08-12 05:45 IST · v0.0.16 — Revenue analytics

- **New Revenue page** under Analytics, built on the 47 imported GST invoices: billed history by financial year, by client, and the full invoice table. Financial years run April to March, so grouping by calendar year would split every year's trading in two and make each half look like a bad year.
- Figures verified against the database directly: ₹28,27,326 counted across five financial years, reconciling exactly with the ₹29,27,326 imported once the cancelled and undated invoices are removed. FY2023-24 was the strongest at ₹10.5L over 21 invoices.
- **What is excluded is stated on the page.** One cancelled invoice was never revenue, and one invoice carries no date so it cannot be placed in any year. Both are named rather than quietly dropped, and any invoice with no amount recorded is flagged so the total is not read as complete.
- Clicking a financial year filters the client breakdown and the table to that year.
- **Money under a lakh now reads as `₹70k`**, not `₹70,000`. The formatter jumped straight from full digits to lakh, so a figure like ₹70,000 took as much room as ₹1.46L sitting beside it, and overflowed the receivables donut. Verified across every boundary from ₹0 to ₹1.25Cr, including negatives.
- **Receivables now use the brand lime**, on a ramp that darkens as the due date recedes, with red reserved strictly for overdue. Colour now carries one meaning: red is a problem, lime is simply outstanding.

## 2026-08-12 05:00 IST · v0.0.15 — brand logos everywhere, radar opens up

- **Brand logos appear wherever a brand does.** Projects, payments and proposals store the client as free text, so every screen except Brands had only a name and fell back to coloured initials. A shared `brandIndex` resolves that text back to the brand row, aliases included, so the real logo shows on the dashboard's live work cards, the receivables list, and every invoice row and detail header.
- **Radar signals open.** Clicking one shows the full detail and source link, and gives you somewhere to write what was actually done about it before marking it solved. Marking something solved previously flipped a boolean and discarded the only part worth keeping, so a recurring alert had no history to read against.
- Reopening a signal clears its resolution and timestamp together, so the record can never say solved and open at once.
- **Invoices can be reassigned to any brand** from the detail panel, with the full brand list. An invoice whose client name matches no brand says so explicitly rather than looking linked.
- **Fixed: the active nav item was invisible in light theme.** It used the raw brand lime as text, which is 1.22:1 against white. It now uses `--brand-text`, at 6.19:1. Dark theme is unchanged at 16.23:1. This is exactly the failure `--brand-text` was added for in v0.0.10, and the sidebar was simply never switched over to it.
- Signal resolution needs `20260812110000_signal_resolution.sql`. Until it runs, marking solved still works and the note is skipped with a message saying why, rather than the action failing.

## 2026-08-12 04:10 IST · v0.0.14 — GST history imported, parked is not open

- **47 GST invoices imported** covering FY2022-23 to date, ₹29,27,326 billed across 9 clients. Seven clients that existed only in the spreadsheet (CWE, IG3 Infra, OSIYA, Open Mind Consulting, Pearl Ports, Purple Dot, Snackbags) are now brands, and every invoice is linked to one.
- **GST numbers backfilled** onto IG3 Infra, Open Mind Consulting, Pearl Ports, Purple Dot and Turquoise, taken from the invoices themselves.
- The importer handles what the sheet actually is rather than what it should be: a header row repeated per financial year, blank spacer rows, three different date formats, and Indian digit grouping that puts a comma inside every amount.
- One row (Pearl Ports, CRE1054) has its amount columns shifted, with the figure sitting under GST and billed left blank. Recording ₹72,000 as tax on a zero invoice would be wrong, so it is stored as the billed amount and the row carries a note saying why.
- **Fixed: re-running the importer failed instead of doing nothing.** Uniqueness is a unique index over expressions, which PostgREST cannot use as a conflict target, so ignore-duplicates did not apply and the whole batch raised a duplicate-key error. Rows already present are now filtered client-side, and a second run reports "47 already present" and exits cleanly.
- **Fixed: a parked project counted as work in flight.** ISIVIS showed "1 project open" for a project with status parked, no dates and no progress. Parked is now counted and reported separately, so the line says "1 parked" instead. The brand stays under Live because it has money outstanding, which is a separate and true reason.
- Commit history: version entries are now annotated git tags rather than a follow-up commit per release, which was filling the log with "docs: cite vX" noise.

## 2026-08-12 03:20 IST · v0.0.13 — dashboard rebuilt, dead cron removed

- **Dashboard rebuilt to the reference layout.** Greeting and date, four stat cards with lime icon badges (Critical, Today, Money waiting, Pipeline), ARC Radar and Money/Receivables side by side, a right rail carrying Focus today above the Activity feed, Live work as project cards with progress, and the pipeline funnel with win rate and average deal.
- Nothing was dropped in the rebuild: severity counts, task priorities and estimates, live-work totals, the unpaid invoice list and the funnel all survive. The receivables figures now come from `lib/money`, so the dashboard and the Invoices screen cannot disagree about what is overdue.
- Delta chips such as "2 from yesterday" are deliberately absent. ARC stores current state only, with no record of yesterday's counts, so there is nothing honest to compare against until a snapshot table exists.
- **Backup export and restore moved into Settings**, recovered from git after they were deleted along with the top header. Restore now validates the file, asks before overwriting, and states plainly that it covers browser settings and not the database.
- **Fixed: the timeline said "no date" for projects that have a start date.** `daysLeft` derives from the end date alone, so a project with a start and no end reported as undated. It now says which date is missing and shows which day of the project you are on.
- **Removed a public, unauthenticated endpoint.** `/api/arc/cron` was exempted from auth in middleware, so anyone could call it, and it wrote run rows to the database before failing. It was never scheduled, nothing referenced it, and it 401'd on every build because it called the pipeline stages over HTTP rather than in-process. Deleted along with its auth exemption; builds are now clean.
- **Average time to get paid** is wired but shows "Not recorded" until the new `payments.paid_at` column exists. The migration deliberately does not backfill: the only candidates are the due date or the row's creation date, and both would manufacture the very number the column exists to measure.
- `(3164508)`

## 2026-08-12 02:40 IST · v0.0.12 — one padding scale, no top header

- **Removed the top header and the sprite.** The header sat above every page's own header, so two bars competed for the top of the screen. Pages now own the full viewport height with no 3.5rem strip to subtract.
- The theme toggle moved into the sidebar footer, since it was the only control in that bar worth keeping. **The localStorage backup import/export buttons went with the header and are not currently anywhere else** (see below).
- **Fixed: pages had three different padding conventions.** Seven used `px-1`, which is 4px and read as stuck against the sidebar. Seven more sized themselves with `min-h-[calc(100vh-120px)]`, where the 120px stood for a header that no longer exists. Only four had a correct responsive scale. All of them now use a single `.page` class, defined once, so this cannot drift again.
- **Fixed: transparent logos disappeared.** A white-on-transparent mark such as ISIVIS vanished on a white card, and a black-on-transparent mark does the same on a dark one. The backdrop is now chosen from the artwork's own ink rather than from the theme: pale ink gets a dark tile, dark ink gets a pale tile, and an image that already carries its own background gets nothing added. Choosing by theme would have fixed one case and broken the other.
- Logos whose host refuses cross-origin reads fall back to a neutral tile rather than failing.
- **Em dashes removed from all user-facing copy**, replaced with the punctuation that actually fits each sentence rather than a blanket swap. The standalone `—` used to mean "no value" is left alone, since a hyphen there reads as broken.
- `(eb8d3a8)`

## 2026-08-12 02:05 IST · v0.0.11 — Money becomes an Invoices screen

- **The invoice reader has a home.** The parser shipped in v0.0.9 worked but nothing called it, so the four blank amounts stayed blank. Selecting an invoice and uploading its PDF or photo now reads the figures off the page and shows them for confirmation. Nothing is written until you press save — the amount, due date and description land on the row only when you accept them.
- The confirm step re-uses the existing payments endpoint rather than re-posting the file with `apply=true`, which would have re-read the document and billed a second model call for figures already on screen.
- Warns when the invoice is billed to a different party than the row says, so the wrong file attached to the wrong client is caught before it is saved rather than after.
- **Receivables maths moved to `lib/money.ts`.** It lived inside the dashboard page while the Invoices screen needed the same numbers, and two copies of a money calculation drift — which is exactly how overdue came to be counted twice. Both screens now read one definition.
- **Layout**: four stats across the top (overdue / due within a month / total outstanding / collected), status tabs with live counts, client and month filters that actually apply, and a list beside a detail panel instead of a table that opened a modal.
- The outstanding stat states how many invoices carry no amount, because the total is an undercount whenever that number is above zero.
- An empty filtered list now says "No invoices match these filters" rather than looking identical to having no money owed.
- **Fixed before it shipped: the screen would have overrun the viewport on mobile.** Pinning the height to `100vh - 3.5rem` ignored the 5rem the layout already reserves for the bottom nav. The height is now pinned only from `lg`, where the panes scroll internally.
- `(c15e707)`

## 2026-08-12 01:35 IST · v0.0.10 — design foundation for the dashboard rebuild

- **Shape and elevation are now a scale, not a guess.** Added `--r-card` (16px), `--r-panel` (20px) and `--r-pill`, plus `--shadow-card` / `--shadow-panel`. Dark theme keeps flat surfaces separated by a border — a drop shadow on a near-black surface is invisible — while light theme carries real elevation, which is how the reference screens read.
- **Fixed before it shipped: lime is unreadable as text on white.** `#CBFA0A` on `#FFF` is roughly 1.4:1, and the sidebar's active nav item uses lime type, so it would have all but disappeared the moment anyone switched to light theme. Added `--brand-text` — the brand lime on dark, a darkened `#4F6A02` (~7:1) on light. The rule is now explicit: `--brand` for fills, `--brand-text` for type.
- **Shared components** in `src/components/ui/`, built once for all three screens rather than three times: `StatusPill`, `SegmentedTabs`, `StatStrip`, `MasterDetail`, `AvatarCluster`.
- `StatusPill` replaces three separate inline status-to-colour mappings — on the Money table, the brand card and the dashboard — which had already drifted apart from each other.
- `StatStrip` supports a delta chip ("↑18% vs last week") but does not require one. ARC stores current state only, with no history of yesterday's figures, so most stats have nothing honest to compare against; the chip stays off until a snapshot table exists.
- **Fixed before it shipped: the list/detail layout collapsed wrongly on mobile.** An inline `flexBasis` overrode the mobile full-width class and pinned the list to 380px on a phone. The width now applies from `lg` up, and below that the detail takes the full width with a back control instead of two unusable columns.
- Not user-visible yet — no screen consumes these. First use is the Money → Invoices rebuild.
- `(ffa3b2c)`

## 2026-08-12 09:05 IST · v0.0.9 — invoices read themselves, logo search fixed

- **Invoices can now be read from a PDF or a photo.** Four payment rows carried a null amount because the figure existed only inside an attachment. BCON's invoice template stopped emitting a text layer somewhere after April 2026 — `Invoice_BCON - Windchasers APR25.pdf` still extracts cleanly, while the newer `BCON - YV Homes Invoice.pdf` and `Exam Windchasers Invoice.pdf` are flattened images that text extraction reduces to "Invoice template design". `/api/ops/invoices/parse` reads the pages visually instead, so scanned, image-only and photographed invoices all work.
- Returns invoice number, both dates, the billed party, subtotal, GST, total, GSTIN, a confidence level and notes, under a JSON schema rather than a hoped-for shape. Verified end to end against a skewed, text-layer-free test invoice: it read Indian 2-2-3 digit grouping correctly (1,85,000 → 185000), read 14-07-2026 as day-first, excluded BCON's own GSTIN in favour of the client's, and returned the ₹1,68,300 balance due rather than the ₹2,18,300 gross after an advance was deducted — recording the discrepancy in notes instead of silently reconciling it.
- Parsing and writing are separate: nothing reaches the books without an explicit `apply`, because a wrong amount written silently is worse than a blank one.
- **Fixed: "Pull logo" could not see logos that were there.** Three faults, each enough on its own — the search listed `public/images` but never descended into `public/images/logo/`; the filename pattern was anchored with `^`, so `ISIVIS-Icon.png` and `Maison-ISIVIS.png` were rejected for not *starting* with a mark word; and `.ico` was missing, discarding real favicons. It now walks the git tree recursively in one call, matches mark words anywhere in the name or in any parent folder, resolves the default branch (this repo is on `master`, not `main`), and ranks square icons above wide lockups, which crop badly into a 36px avatar.
- When `GITHUB_TOKEN` is absent the response now says the repo was never searched, instead of reporting that the repo contains no logo.
- **Real ARC artwork in the sidebar.** The supplied logo is a blackout variant — a #1C1E22 letterform on solid black with no alpha — so dropped in as-is only the lime wedge would have shown on the dark shell, and light theme would have rendered a black box. Both sources are rebuilt as transparent PNGs with the ink recoloured per theme and the lime left untouched; 1.2MB of source art becomes 52KB of assets.
- **Version now sits beside the logo.** It was footer text, below the fold on a short viewport.
- **Fixed: two theme toggles.** The global TopBar and the dashboard header each rendered one, a row apart.
- **Brands grouped Live / Proposed / Completed**, then agencies and partners. A brand with only a proposal out is no longer counted as Live — nothing has been won yet, so it reads as a decision pending rather than work in progress.
- User-facing: upload an invoice and ARC fills in the amount; brand logos actually pull; the sidebar carries the real mark and the running version.
- `(954b592)`

## 2026-08-12 00:20 IST · v0.0.8 — brands list simplified, logos resolved properly

- **Fixed: the Money panel counted overdue invoices twice.** Every payment in the database has a null due date, so all of them fell into the "31 days+" bucket while the same rows were also reported as Overdue — ₹70,000 and ₹40,000 describing overlapping money. Buckets are now mutually exclusive, status wins over date, and undated invoices get their own bucket instead of being quietly filed as "31 days+".
- **Fixed: invoices with no amount were invisible.** Four of six unpaid rows have a null amount, so the "money waiting" headline was an undercount presented as fact. The panel now says how many invoices carry no amount.
- **Fixed: the donut's centre label overflowed its ring.** A value like ₹70,000 at a fixed 20px spills straight over a 78px donut and reads as a rendering fault. Font size now scales to the ring.
- **Brands list stripped back.** It was showing a health ring, three money columns and a sparkline per card — detail that belongs on the brand itself. Cards now carry a logo, a name and one line saying what is actually happening, grouped Live / Completed-dormant, then agencies, partners, prospects and own products.
- **Logos are resolved once, server-side, and stored.** Guessing a favicon at render time doesn't work: Google answers 200 with a generic grey globe for sites that have none, so the error fallback never fired and cards showed a placeholder worse than initials. `/api/ops/brands/logo` searches any linked repo for a logo file, falls back to a favicon only when the response is big enough to be real, and writes the winner to `logo_url`.
- **Repos can be linked from the brand page.** Paste `owner/repo` or a GitHub URL, and "Pull logo" fetches the mark straight out of it — verified against `bconclub/windchasers`, which yields `public/icon-192.png`.
- User-facing: Brands is now a scannable list of what's live; brand pages gain repo linking and logo pulling.
- `(93b2b6d)`

## 2026-08-12 00:05 IST · v0.0.7 — brands classified by relationship

- **Not everything in `brands` is a client.** Added a `kind` column — client / agency / partner / prospect / own — matching the vocabulary already used in `people.relation`. The Brands page groups by it, clients first, so a prospect no longer sits in the same grid as a paying account.
- **Corrected a modelling error from v0.0.6.** Now Media had been folded into Kosh Studios as an alias, and Proago into Laptop Store, treating agencies as alternate spellings of their clients. Both are now separate rows: Now Media is an agency, Proago a partner. Neither is ever invoiced, which is what gave it away.
- **Work arriving through an intermediary is recorded.** New `via_brand_id` — Kosh Studios stays a client because it is the name on the invoice, and links to Now Media. The profile reads "Client · via Now Media".
- **Agency contacts surface on the client profile.** Moving Nithin and Afnan to Now Media left Kosh Studios showing no contacts at all; its profile now lists the agency's people in a separate "Via Now Media" block.
- Classification as shipped: 9 clients, 1 agency (Now Media), 1 partner (Proago), 1 prospect (Axlrate R&I), 3 own (BCON Club, PROXe, OUCH! Piercing).
- Verified live: every client name on payments/projects/proposals still matches a brand, and all 11 people now attach to one.
- User-facing: Brands page is grouped by relationship; profiles gain a Type selector and a "work arrives via" field.
- `(848ed76)`

## 2026-08-11 23:40 IST · v0.0.6 — brands become the client register

- **Switched Supabase projects.** `.env.local` pointed at `niypveotxuledkrcikun` while the schema migration had been applied to `rqpjynurdlozjxvzkugy`. That mismatch — not a bad migration and not a PostgREST cache — is why the new columns appeared missing. The new project also carries richer operational data: 10 projects, 11 people, 19 signals against 5/8/8.
- **Brands are now the clients who pay you.** That project's `brands` table held placeholder rows from an early draft of the migration, and none of the nine real client names matched any of them, so every money-per-brand figure read zero.
- New migration `20260811010000_brands_as_clients.sql` — additive and non-destructive. Adds the client-register columns (aliases, domains, gstin, place_of_supply, lifetime_revenue) plus `people.brand_id`, folds `KOSH Studio` into `Kosh Studios`, inserts the missing clients, backfills aliases and links contacts. It deletes nothing; BCON Club, PROXe and OUCH! Piercing remain for you to remove by hand if unwanted.
- Aliases are taken from real strings in the data, so variants resolve to one brand: `Laptop Store` ← Laptop Store India / Laptopstore / itel computer / Proago; `Turquoise` ← Turquoise Holidays / Turquoise Ops; `WOWBUS (Arvin Software LLP)` ← Arvin Software LLP; `Kosh Studios` ← KOSH Studio / Now Media.
- **Fixed:** a contact whose org spans two brands was hidden from one of them. `people.brand_id` can only point one way, so "WindChasers / Turquoise" resolved to Turquoise alone and WindChasers showed no contacts. Matching is now a union of the FK and the org text, so Sumaiya appears under both.
- Brand and Person types now mark cross-project columns optional, since the two databases carry different column sets.
- Verified against live data: every client name on payments/projects/proposals matches a brand, 10 of 11 people link (Alia Tabassum's org "Axlrate R&I" is not a brand), `system_health` seeded with 9 rows.
- User-facing: brand cards show real money and contacts instead of zeros.
- `(f92a381)`

## 2026-08-11 23:10 IST · v0.0.5 — brand contacts

- **Brand profiles now show Contacts.** Linked through `people.brand_id` (populated on 7 of 8 rows) with a fallback that matches the free-text `org` against the brand's name and aliases, splitting compound values on `/` and `,`. That fallback is what catches an org recorded as "Laptop Store India / proago.in".
- Emails and phone numbers are parsed out of the free-text `channel` field into `mailto:` / `tel:` links; anything unrecognised is still shown as plain text rather than dropped.
- **Fixed:** the brand profile listed payments/projects/proposals by exact name while the totals above them matched aliases too, so a brand's rows could disagree with its own header figures. Both now use the same keys.
- Versioning note recorded: the patch counter runs 0.0.1 → 0.0.100, then rolls to 0.1.0.
- User-facing: a Contacts card per brand, with click-to-mail and click-to-call.
- `(e888ef2)`

## 2026-08-11 22:50 IST · v0.0.4 — operations command centre, brands, connectors

- **Dashboard rebuilt as a single-viewport command centre.** Six panels (Radar, Money, Focus, Live Work, Activity, Pipeline) in a fixed 100vh grid on desktop; the page never scrolls, each panel scrolls internally. Below `lg` the grid unlocks and scrolls normally.
- **Activity no longer duplicates Radar.** They read the same table before, so every open alert rendered twice. Radar = unresolved signals; Activity = things that happened (resolved signals, payments in, proposal moves, completed tasks, project progress), with radar ids excluded outright.
- **New Operations page** (`/dashboard/operations`) — Gantt-style delivery timeline built from real project dates with a today marker, "lands this week" merging tasks + deadlines + payments, blocked work, and pipeline.
- **Brands are first-class.** List + editable profile with GST/billing block, aliases, linked repos and commits. Rollups match on brand name *and* aliases, so invoices entered under an alternate spelling still count.
- **Admin connectors panel** (`/dashboard/admin`) — nine connectors with env-var presence checks and live reachability probes. Secrets stay in env; the server coerces `process.env` to booleans at the module edge so no credential can reach the client.
- **GitHub activity** — resolves user vs org accounts, reads private repos, and pulls per-repo commits (the events feed no longer carries commit messages). Brand-linked repos may live under a client's account and are marked when unreadable.
- **Brand identity** — ARC mark traced to theme-aware SVG (the supplied PNGs are near-black and vanish on the dark shell), lime `#CBFA0A` sampled from the source art, new favicon and apple icon, nav accent moved from red to brand lime with red kept for danger.
- **Mobile navigation fixed** — the bottom bar exposed 5 of 17 destinations and the rest were unreachable; added a full-nav drawer.
- Schema: additive migration adds `logo_url` / `color` / `github_repos` to `brands`, creates `system_health`, and adds task priority/estimate. `services` is the GST billing catalogue and is left untouched — infrastructure health was moved off it.
- Builds now honour `NEXT_DIST_DIR` so `next build` can't corrupt a running dev server.
- User-facing: dashboard, operations, brands and admin are new screens; nav labels and the app icon change.
- Version scheme corrected: patch counts 0.0.1 → 0.0.100 before the minor rolls. An earlier commit in this batch wrongly jumped to 2.1.0 to match a design mockup.
- `(pending)`

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
