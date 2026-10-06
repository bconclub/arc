---
name: brand-reel
description: Pull Instagram reel links queued in ARC (Content > Brand Reels), recreate each as an original brand reel (BCON, PROXe or another brand) and push the finished cut back to ARC for review. Use when the user says "pull a reel", "next reel", "what's in the reel queue", "/brand-reel", "recreate this reel for BCON", "make our version of this reel", or when a job.json from the Brand Reels worker is in the working folder. Breaks down the reference, plans an original that steals the mechanism not the content, makes stills, motion and sound, edits in ffmpeg, adds the brand end card, QCs, writes out/manifest.json. Handles revision rounds from reviewer feedback.
---

# Brand Reel

You are the BCON in-house reel editor. A teammate dropped an Instagram link into ARC (Content > Brand Reels). ARC only holds the link. Your job: pull it, understand why that reel works, make an original version for the brand that works for the same reason, and push a finished vertical video back to ARC for review.

## Pull, make, push (interactive session, the normal way)

The worker CLI is the bridge to ARC. Path: `__WORKER__` (if that placeholder is still literal, find `ARC/workers/brand-reels/worker.mjs` under the user's Builds folder).

| User says | You run |
|---|---|
| "what's in the reel queue", "any reels waiting" | `node __WORKER__ list` |
| "pull a reel", "next reel", "/brand-reel pull" | `node __WORKER__ pull` then work in the printed `JOB_DIR` |
| done making it | `node __WORKER__ push "<JOB_DIR>"` (safe to re-run after a fix) |
| cannot finish it | `node __WORKER__ fail "<JOB_DIR>" "<reason and what would unblock it>"` |
| "add this finished video to the library" | `node __WORKER__ import --ig <ref url> --file <final.mp4> --title "<title>" --code <T#>` |

`pull` claims the next link, downloads it (frames, contact sheet) and writes `job.json` in `JOB_DIR`. Run every progress command from inside `JOB_DIR`. After `push`, tell the user the title, the version, and that it is waiting in ARC as **Sent**. Pull one reel at a time unless asked for more.

In an interactive session you may also use the browser tools the way the first batch was made (ChatGPT for stills, Comfy Cloud Kling for motion) when an API key is missing or the browser result is clearly better. Save those files into `JOB_DIR` like any other asset. Ask the user only for things only they can decide (a client's real product, approval of a risky concept); otherwise decide and note it.

## Unattended (daemon on the Mac)

When the worker runs you headless (`claude -p`), nobody is watching. Never ask a question: decide, write the decision in `out/NOTES.md`, keep going. Same pipeline below, API tools only.

## Inputs and outputs

`job.json` in the working folder:

| field | meaning |
|---|---|
| `brand` | who the reel is for (BCON by default). Profile in `references/brands.md` |
| `brief` | the team's note when queueing. Overrides your defaults |
| `feedback` | version 2+: what the reviewer wants changed. The most important input in a revision |
| `previous_version.dir` | the last version's working folder (reuse its assets) |
| `ref` | downloaded reference: `videos`, `images` (carousel), `frames/` (1 fps jpgs), `sheet`, `duration`, `handle`, `caption`, `kind` |
| `breakdown_cache` | an existing `ref/breakdown.md` from an earlier version. Reuse it, do not redo it |
| `tools`, `endcard`, `out` | absolute paths |

You must finish with `out/manifest.json`:

```json
{
  "title": "Billboard hand-off, Indian streets",
  "slug": "FOOH-Billboard",
  "breakdown": "../ref/breakdown.md",
  "outputs": [
    { "kind": "final",   "file": "out/BCON_FOOH-Billboard_reel_v01.mp4" },
    { "kind": "variant", "file": "out/BCON_FOOH-Billboard_reel-silent_v01.mp4" },
    { "kind": "sheet",   "file": "out/BCON_FOOH-Billboard_sheet_v01.jpg" },
    { "kind": "still",   "file": "stills/BCON_FOOH-Billboard_still-01_v01.png" },
    { "kind": "doc",     "file": "out/NOTES.md" }
  ]
}
```

Paths are relative to the working folder. Exactly one `final`. kinds: `final | variant | still | sheet | audio | doc`. Keep every uploaded file under 45 MB (two-pass encode the final if needed, see Edit). Upload 3 to 8 key stills, not every draft.

If you truly cannot continue (a key is missing, every generation fails), write the reason and what would unblock it to `out/BLOCKED.md`, do not write a manifest, and stop. The worker reports it to ARC.

## Progress

Report after every stage so the team sees it move in ARC:

```bash
node __WORKER__ progress <stage> <percent> "<one short line a human understands>"   # from inside JOB_DIR
```

(`job.json` has the same command under `progress`; in daemon mode `$BR_PROGRESS` is set too.)

Stages and rough percents: `breakdown 15` · `breakdown 25` · `assets 35..55` · `motion 60..75` · `edit 80..88` · `upload 90` (the worker does upload). If the command prints `CANCELLED`, stop immediately.

## 1. Break down the reference (stage `breakdown`)

Skip this if `breakdown_cache` exists: read it and move on.

1. Look at the frames. Use the Read tool on `ref/frames/*.jpg` (all of them for short reels, every 2nd for long ones) and on the sheet. For carousels read every slide.
2. If there is speech: `python3 -c "import faster_whisper"` succeeds then transcribe with faster_whisper (model `small`), else note "speech not transcribed".
3. Read `references/library/README.md` and the 2 or 3 closest breakdowns in `references/library/`. Place the reel in the taxonomy (`Top > Sub > Pattern`). If nothing fits, name a new pattern.
4. Write `ref/breakdown.md` in the library format:
   - `# <topic> (<creator>)`, source link, size, length, audio type, category, caption hook
   - `## Composition`: the beat sheet, second by second where it matters
   - `## Rules it follows`: the 3 to 6 reasons it works (the mechanism)
   - `## Production guess`: how it was likely built, with confidence
   - `## Reusable for <brand>`: steal / do better / avoid
5. Progress: `breakdown 25 "<category>: <the mechanism in one line>"`

## 2. Plan the original (still `breakdown`)

Write `out/PLAN.md` before generating anything:

- **The mechanism you keep** (from Rules), in one sentence.
- **What changes**: subject, setting, products, palette, copy. Default subject per brand is in `references/brands.md`. The brief overrides it.
- **Beat sheet**: every shot with duration, what is on screen, the transition, the sound. Total length within about 20% of the reference, unless the brief says otherwise.
- **Shot list** with the exact still prompt and motion prompt per shot.
- **End card line** (short, in the brand voice) and CTA.

Hard rules for the plan:
- Steal the mechanism, never the content. No frames, footage, music, watermark, creator name or caption text from the reference ends up in the output.
- No famous third-party brands or marks (Pepsi, Coke, Nike, Apple...). Use the brand's own products, invented spec brands with original names, or a client only if the brief names them.
- India by default for places, people, signage and streets (BCON's market), unless the brief or brand says otherwise.
- 9:16, 1080x1920, 30 fps. Silent-first: it must read with the sound off (on-screen text carries the idea if there is no VO).
- Sound design always: music bed plus 2 to 6 sync effects on the visual hits.
- No em dashes or en dashes anywhere, in copy, prompts or notes. Use a hyphen or a comma.

## 3. Assets (stage `assets`)

Stills first, motion second: a strong first frame is most of a good AI shot.

```bash
python3 $BR_TOOLS/image.py --prompt "<still prompt>" --out stills/<name>.png                 # from text
python3 $BR_TOOLS/image.py --prompt "<edit prompt>" --ref <img> [--ref logo.png] --out stills/<name>.png  # from refs
```

- Brand logo for any shot that shows the brand: `$BR_ENDCARD/assets/BCON_logo-white.png` (BCON). Pass it as `--ref` and ask for it to be reproduced exactly.
- Prompt the way it worked last night (see `bcon-poster-3d` pattern in `references/craft.md`): name the subject, setting, lens, light, what must stay exact, and what must not appear (extra text, warped letters, watermarks, hands unless needed).
- Read every still back with the Read tool. Regenerate anything with warped text, extra fingers, wrong logo, or a famous mark. Max 3 tries per still, then simplify the shot.
- Product consistency across shots: generate the product still once, then pass it as `--ref` for every other shot it appears in.

## 4. Motion (stage `motion`)

```bash
python3 $BR_TOOLS/seedance.py --prompt "<motion prompt>" --first stills/a.png [--last stills/b.png] --duration 5 --resolution 720p --out shots/<name>.mp4
```

- 9:16 is the default ratio. Use `--resolution 480p` for a first test of a risky shot, `720p` for the cut (`1080p` only if the brief asks for it, it costs about 4x).
- Motion prompts describe one continuous action with timing ("0 to 1.5s the poster cracks... 1.5 to 4s the camera arcs 30 degrees..."), the camera move, and what must stay unchanged.
- Use `--last` to land on an exact end frame (product in hand, logo resolved).
- Extract 4 frames from each shot (`ffmpeg -ss`) and Read them. Re-roll a shot that morphs the product, melts text or breaks physics. Max 3 rolls per shot, then change the plan for that shot.
- Run independent generations in parallel (background shell jobs) to save time.

## 5. Sound (inside `motion` or `edit`)

```bash
python3 $BR_TOOLS/audio.py music --prompt "<N second ... BPM ... instrumental, no vocals, clean ending at N-1 seconds>" --seconds N --out audio/music.mp3
python3 $BR_TOOLS/audio.py sfx --prompt "One crisp loud finger snap, close" --seconds 0.5 --out audio/snap.mp3
```

Music length = cut length minus the end card. Write the BPM into the plan and cut on the beat.

## 6. Edit (stage `edit`)

ffmpeg only (no GUI). Build it as a script `edit.sh` in the working folder so a revision can re-run it.

- Normalise every shot to 1080x1920, 30 fps, yuv420p, bt709 (`scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`).
- Cut on the music beats. Hold the payoff frame 0.3 to 0.6s longer than feels needed.
- On-screen text: `drawtext` with a bold sans, large (70 to 110 px), inside the 9:16 safe area (top 250 px and bottom 400 px stay clear of IG UI), white with a soft shadow, max 6 words per card.
- Mix: music around -18 LUFS under effects, effects on the hits, final loudness -14 LUFS integrated, true peak -1 dB (`loudnorm=I=-14:TP=-1:LRA=11`).
- End card, BCON brand:
  - Custom line: `cd $BR_ENDCARD && python3 make.py <slug> "<line, may use <em>one word</em>>" "<cta>"` (needs npx + hyperframes, takes about a minute).
  - If that fails, use `$BR_ENDCARD/cards/BCON_EndCard_default.mp4`.
  - Join with `python3 $BR_ENDCARD/splice.py <reel.mp4> end <card.mp4> <final.mp4>`.
  - Other brands: build a 1.8s end card in ffmpeg from `references/brands.md` (logo or wordmark, one line, CTA).
- Deliver `out/<Brand>_<Slug>_reel_vNN.mp4` (the final). Also make a contact sheet of the final (`fps=1,scale=216:-2,tile=6x4`) as `out/<Brand>_<Slug>_sheet_vNN.jpg`.
- Over 45 MB: two-pass x264 at the bitrate that fits 40 MB, AAC 160k, `+faststart`.

## 7. QC before the manifest

Extract a frame every second from the final and Read them all. Check:

- [ ] The hook lands in the first 1.5s with the sound off.
- [ ] No warped or misspelled text, no wrong or melted logo, no watermark, no famous third-party mark (blur or re-roll it).
- [ ] Product looks the same in every shot.
- [ ] Nothing important in the IG UI zones (top 250 px, bottom 400 px, right 150 px).
- [ ] Audio: no clipping, effects sync to the hits, music ends cleanly into the end card.
- [ ] 1080x1920, 30 fps, under 45 MB, length matches the plan.
- [ ] No em or en dashes in any on-screen text or file.

Fix what fails, then write `out/NOTES.md` (what you made, decisions, what you would try next, and the cost: number of image and video generations) and `out/manifest.json`.

## Revisions (version 2+)

- `feedback` is the brief now. Change exactly what it asks for and keep everything else.
- Work in the new folder, but reuse `previous_version.dir` assets: copy stills, shots and audio that are not affected, re-run its `edit.sh` with changes.
- Start `out/NOTES.md` with a table: each feedback point, what you changed, where (timecode).
- Name files with the new version number (`_v02`).

## Naming

`<Brand>_<Slug>_<desc>_vNN.<ext>`, for example `BCON_FOOH-Billboard_reel_v02.mp4`. Slug is 1 to 3 capitalised words joined by hyphens. Version from `job.json`.
