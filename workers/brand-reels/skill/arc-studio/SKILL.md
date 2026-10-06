---
name: arc-studio
description: Work from ARC Studio, the per-brand board in ARC (Content > Studio) where the founder drops requests, moods and ideas for every brand BCON creates for. Use when the user says "check the studio", "studio inbox", "any requests", "poll ARC", "put it in the studio", "log these images", "add this brand to the studio", "what mood are we going for on <brand>", or right after making images, ideas or decisions for any brand (BCON, PROXe, Evernuts, Velqine, new ones). Pulls open requests, records every still made in GPT/ChatGPT with its prompt, logs ideas and notes, keeps mood, palette and brief current.
---

# ARC Studio

ARC Studio is the single place the founder looks to see **which brands we are working on, what mood we are going after, and what ideas and images exist**. If you made it or decided it and it is not in the Studio, the founder cannot see it.

CLI: `node __STUDIO__ <command>` (if the placeholder is literal, find `ARC/workers/brand-reels/studio.mjs` under the user's Builds folder). Reels have their own queue: see the `brand-reel` skill.

## 1. Poll the inbox

```bash
node __STUDIO__ inbox
```

Do this at the start of every working session, when the user says "check the studio", and between jobs. If the user asks you to keep watching, use `/loop` with a 10 to 20 minute interval on "check the studio inbox and work any open request".

For each request you take:

```bash
node __STUDIO__ take <id>
node __STUDIO__ brand <slug>          # read mood, palette, brief, existing board before making anything
# ... make it ...
node __STUDIO__ images <slug> out/*.png --for <id> --prompt "<exact prompt>" --title "<short title>"
node __STUDIO__ done <id> "<what you delivered, where, what is left>"
```

Stuck on something only the founder can decide? Leave it in `doing`, add a note (`note <slug> "Question: ..." "..."`) and tell the user.

## 2. Log everything you make

| You made | Run |
|---|---|
| Stills in ChatGPT/GPT or the image API | `images <slug> <files...> --prompt "<the prompt>" --source gpt [--for <request-id>]` |
| Frames pulled from a cut, references, brand assets | `images <slug> <files...> --source frame` / `--source asset` |
| A concept worth making | `idea <slug> "<title>" "<one paragraph: the mechanism, why it fits the mood>"` |
| A decision, finding, client feedback, a risk | `note <slug> "<title>" "<details>"` |
| A task for later or for another editor | `request <slug> "<title>" "<details>"` |

Always record the exact prompt with GPT images: the founder uses it to ask for "more like this". Title images so a human can tell them apart (`Ruby jhumka, Diwali window light`), not file names.

## 3. Keep the brand current

```bash
node __STUDIO__ brands
node __STUDIO__ set <slug> --name "<Name>" --status intake|active|paused --mood "<one or two lines>" --palette "#hex #hex" \
  --site <url> --ig <@handle> --drive <folder url> --brief-file BRIEF.md --logo logo.png
```

- New brand from an intake: `set` it with status `intake`, its brief file, logo, palette and a first mood line, then `images --source asset` for the brand assets.
- **Mood** is the feeling we are going after in one or two lines (light, materials, energy, what never to do). Update it when the founder changes direction. It is the first thing the founder reads.
- Palette: brand colours first, max 8 hex values.

## The client can see part of it

A brand's board can be shared with the client (ARC: Client board > Share with client). The client then sees the **mood, palette, ideas and images** (not requests, notes, prompts, sources or authors) and picks what they like. So:

- Write ideas, image titles and the mood as if the client is reading. Never mention other clients or brands, internal methods ("the Evernuts method"), costs, tools or risks there. Put that in a note.
- Internal-only image or idea (tests, references from other brands, rejected directions): add `--hidden 1` to `images`, or run `hide <id>`.
- Check picks before making more: `brand <slug>` shows them in ARC; the most loved items are what to make next.

## Rules

- Respect the brand's notes and brief before making anything (claims risks, real-product-only rules).
- No em dashes or en dashes in anything you write to the Studio.
- Never put secrets, client personal data or prices you invented into the Studio.
