# A launch film end to end

The order that works, learned on SecondSpring (T19, 2026-10-10) and ZenSquare (2026-10-23/24). ZenSquare went from
"here's our site" to a finished, animated 30s film with voiceover and music in about a day, for $2.52.

## 1. Understand the product (no spend)
- Read the live site and, if we built it, the site repo. Write down what it is, who buys it, what it is NOT, the promise,
  the funnel (where leads go), and the **guardrails the site already sets** (e.g. ZenSquare: the only number is "1000s
  of students taught"; universities are "goals, not partners", so no crests and no "guaranteed admission").
- The buyer and the user can differ (ZenSquare: the parent pays, the student studies). Write for the buyer.
- Pull brand tokens from the code, not by eye: CSS variables for colours, `next/font` for type, `public/brand/` for
  logos. Check whether site photos are stock (they were): never put stock photos in a film.
- Save a short plan (`content/social/<date>-<brand>-gtm-plan.md`): what we make, order, cost, blocking questions.
  Ask only questions that truly block (target market, real results we may state, tutor/owner footage).

## 2. Mood board = six real-looking stills (ChatGPT, $0)
- Write the A-F blocks once (format, product truth, look, cast, shot list, avoid) per
  [../../storyboard-prompting.md](../../storyboard-prompting.md). The founder may want the board **image by image**:
  then generate six single 9:16 stills in ONE ChatGPT chat, frame 1 with the full blocks, frames 2-6 as "same people,
  room, light and grade" + the new shot line.
- Story in six frames for a parent-bought product: the child working (close-up) → the product in use (over the shoulder)
  → the proof detail (macro) → the buyer watching (parent in the doorway) → the buyer's moment of trust (report on the
  phone) → the destination (campus). Send each frame to the founder as it lands.
- Check each still before sending (see [stills-and-realism.md](stills-and-realism.md)). Note AI flaws honestly (ZenSquare
  frame 3: the AI's maths was wrong; fine for the look, real worked papers for the film).

## 3. Sound first: music options + voiceover (ElevenLabs, subscription)
- Two music options from one brief (30s, BPM, instruments, arc, "no vocals"). The founder picks by ear.
- Voiceover script from the site's own words, about 60-65 words for 26s. Spell numbers as words ("Grade nine", "A star").
- Generate, download, find the sentence pauses (`silencedetect`), and **cut the pictures to the pauses**. See [sound.md](sound.md).

## 4. Animatic (stills + slow pushes + VO + music, $0)
- Build it in code (`build_preview.py`): frame 0 = hero still + title for 0.6s, each still with a slow push/pull, the
  caption for its VO line, a logo end card, music ducked under VO, -14 LUFS. Show both music options as two files.
- The founder judges story and voice here, before any paid motion. A preview page in the app's browser pane
  (`python -m http.server` over a folder of mp4s + a 2-player HTML page) lets them watch side by side.

## 5. Motion (ComfyUI Cloud, Kling 3.0 720p std, ~$0.42 per shot)
- One shot per still, 5s, image-to-video, a prompt that describes small natural movement and a slow camera move.
- State the cost before each run, one job at a time, strip-check each take, accept or change the prompt and say why.
  ZenSquare: 6/6 accepted on the first take, $2.52. See [motion.md](motion.md).

## 6. The final cut
- Same edit script, clips in place of stills: trim the usable part of each take, slow up to ~1.2x where a VO slot is
  longer than the take, scale 720p → 1080x1920, same captions, end card and mix. Two masters (music option 1 and 2).
- Frame 0 = first frame of the hero clip + title. Check frame 0, a contact strip, duration, LUFS. See
  [edit-and-delivery.md](edit-and-delivery.md).

## 7. Deliver and record
- Send the files, open them in the preview pane, log spend + files in the spec, push the understanding to ARC Studio
  (brand brief, palette, logo, notes, stills with prompts, the film) so any agent can pick it up.
- Offer the 1080p re-render (same stills, prompts, seed) with its price; don't run it until the founder approves.

## What blocked us (and what to do)
- **BCON Club browser not connected:** stop, write the brief/prompts meanwhile, ask the founder to open it.
- **ComfyUI "Subscription or credits required" / "Update payment to run"** with a positive balance = the payment method
  failed. Stop; the founder fixes billing. Nothing is charged.
- **ElevenLabs at ~10% credits shows an upgrade pop-up:** close it, never upgrade.
