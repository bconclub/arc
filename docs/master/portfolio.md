# The BCON portfolio

Format, set by Z: one case study per brand, showing everything built for it (branding, app, website, films). Scan2Kare
is Z's example. Z's reason: "we do not have time to update our projects", so finished work has to flow in.

## Where it lives
Repo `C:\dev\builds\bconclub`, branch `feat/portfolio-flythrough`, which tracks `origin/production`. **Pushing there goes
live** through a GitHub Actions deploy to the VPS (pm2).

| Page | What it is |
|---|---|
| `/flight` | The self-playing film: bass, bending, a "break in" to each brand. Mix of Active Theory, Lusion and Unseen. Live, noindex |
| `/work` | All brands, two cards a row, per-brand colours, logos |
| `/work/<brand>` | One brand's case study |
| `/campaigns` | Slider replacing the Canva campaign deck. Its claims come from that deck |

## One data source
All four pages read `components/Flight/brands.js`, plus generated `films.json` and `assets.json`. Git tracks the folder as
`components/Flight` with a capital F.

- `CH`: brands in the flythrough. `MORE`: brands only on the work pages. `THEMES`: colours.
- `DETAILS` by slug: story, app, films, site, campaign data, card overrides.
- `allBrands()` merges films, gallery and logo, filters `.art` hero stand-ins, sorts by weight: films x2 + items + gallery +
  app screens, +3 if there are campaign results. More work sits on top, as Z asked.
- `.art` heroes are placeholders that 404 and fall back to generated artwork. The filter hides brands that only have those.
- Media is in `public/work/`: brand films and posters, `logos/`, `ig/`, `scan2kare/app`.

## Adding a brand's work
When any session finishes work for a brand:
1. Confirm the video is final (see [founder-rules.md](founder-rules.md)).
2. Check it's BCON's own work and not partner work, and whether the client has approved showing it.
3. Add it under the brand's slug in `brands.js`. Put media in `public/work/`.
4. Add screens and links for apps and sites, not only films. Z's complaint was Scan2Kare's app not being clickable.
5. Run a production build and check it (see below). Z reviews before anything goes live.

## Campaigns slider
`CampaignSlider.tsx` has cover, brand, challenge, list, media and end slides. Wheel, swipe, keyboard, arrows, a progress
bar and a `#n` hash all work. `data-lenis-prevent` keeps the smooth-scroll library off it. Don't use scroll-snap with
Lenis: that was the version Z rejected.

## Checking it
- Dev streaming leaves a hidden duplicate `main` (height 0), so `querySelectorAll` can count double, especially in a hidden
  browser pane. Check `offsetHeight` or use a production build. Production shows one `main`.
- `bcon-site-prod` in `C:\dev\builds\ISIVIS\.claude\launch.json` runs the production build on port 3100.
- The live homepage already throws React error #418. Portfolio changes didn't cause it.
- The build rewrites `.env.production`. Keep it out of commits and restore it.

## Pulling media
Scripts are in `C:\dev\builds\video-library\`: `pull_work.py`, `pull_logos.py`, `find_logos.py`, `ig_pull.py`, `ig_meta.py`,
`drive_match.py`, `poster_sheet.py`, `fix_posters.py`. Instagram can't be read logged out for some accounts, so a handle
that returns nothing isn't proof of anything. Check a handle really belongs to the brand before using its posts.

Check posters by eye after cutting them: three came out dark. Check reels for duplicates: two brands had the same reel twice.

## Open
Review status and the list of missing inputs are in `private/open-items.md`.
