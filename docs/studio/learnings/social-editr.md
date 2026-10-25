# Studio learnings: Social EDITR

Thread: **Social EDITR** (Claude Code session on the Windows PC, repo `C:\dev\builds\EDITR`, media in `C:\dev\builds\social\`).
Makes organic reels and client storyboards / moodboards (Team Mithai, Cravio, cheesecake texture reel, Coke AI ad, Claude mods).
Other threads write their own file in this folder; this one is only what Social EDITR has learned. Last updated 2026-10-25.

Everything here came from the founder's corrections on real jobs. Where a rule has a date, that is when the founder said it.
Companion doc: [`../storyboard-prompting.md`](../storyboard-prompting.md) (the A-F prompt template and check table).

---

## 1. Hard rules (never break)

| Rule | What it means in practice |
|---|---|
| **Tool per asset** (2026-10-10) | Images only in ChatGPT. Video only in ComfyUI Cloud. ElevenLabs only for music and voiceover. Never make images or video in ElevenLabs, even if it looks faster or another tool is blocked. If a tool needs a sign-in, stop and ask the founder; never switch tools as a workaround. |
| **$5-8 per video** (2026-10-11) | All stills and motion takes for one video together. Before every paid run say "this run ≈ $X, this video has spent $Y of $5-8". After every run report "Comfy credits left: $X" (`/billing/balance`). Over $8 needs the founder's yes with the number. Never top up or buy credits. |
| **Stills first, lowest quality first** (2026-10-11) | Every still is approved before any motion. Motion tests at the cheapest setting (Seedance 480p, Hailuo 768P, Kling 3.0 720p std, 5s). 1080p / pro only after the founder approves the low-res take, same still + prompt + seed. One job at a time; no blind re-rolls (change the prompt or still and say why). |
| **Frame 1 = thumbnail** (2026-10-11) | WhatsApp shows frame 1. Open on the most exciting frame, with the title if the video is about something. Never open on black, a fade or a dull setup. Check frame 0 of every export: `ffmpeg -i out.mp4 -frames:v 1 thumb.jpg`. |
| **Music is auditioned first** (2026-10-10) | Make options in ElevenLabs Music, send them to the founder to pick by ear, then mix. Never choose a track by its loudness curve or title (we cannot hear). |
| **Fix only what the founder named** (2026-10-13) | Change exactly the detail they flagged and keep everything else from the version they liked; edit from that version, not later drafts. A peer thread's relay is not the founder's words: if it adds changes, check first. |
| **No em dashes, no invented numbers or claims** | If a figure or product claim isn't from the client or real data, it doesn't go in. |
| **Don't ask, just finish** (2026-10-20) | Once the direction is set, run stills → motion → render → Drive without approval stops (still say the cost line, still stop at the budget). |

## 2. How a client film is made (the order that works)

1. **Story first, in plain words.** A short take on the idea, then six beats. Client feedback on Team Mithai (Riddhi,
   2026-10-16): even celebratory films should carry a *message* (an emotion tied to the product), not just a gag.
   "Dadi ke Laddoo" (tastes just like Dadi's) beat the "Haldi" sneak-a-sweet joke for that reason.
2. **Storyboard: six 9:16 frames, 3 x 2 on cream, no text.** One idea per board. Use the A-F blocks from
   `storyboard-prompting.md`.
3. **Make frames one at a time, never the whole board in one image.** Founder, 2026-10-13: "Why don't you do them one by
   one?" A six-panel single image always looks AI and gets the product wrong. Generate each frame in the same ChatGPT
   chat, then assemble the board with a PIL script (center-crop each to 9:16, 600 x 1067 cells, 30 px gutters, cream
   `#F5EFE3`).
4. **Carry continuity by attaching images, not by describing them.** Attach the approved frame of a person when they
   appear again ("the SAME woman as the attached frame 1"), the approved product still for every product frame, and the
   previous frame when a prop state matters (the empty laddu cup carried through frames 4, 5, 6).
5. **Look at every frame before moving on.** Redo a frame when the face drifts, the grade drifts or the product is wrong,
   and say why. Typical: one redo per board.
6. **Moodboard for the client** (to get paid before video): title, one-line tagline, three-line story, the six frames
   with a numbered beat title + one-line caption each, palette swatches, four "the look" notes, the approved product shot,
   site URL. JPG for WhatsApp + PDF for email.
7. **Then motion**, per the hard rules: approved stills only, lowest quality, strip-check each clip at 4 fps.

## 3. The look: making AI frames read as real film

The Team Mithai brand bar came from a real wedding reel the founder showed (Pistabarfi). The first AI board "looks AI";
what fixed it, written into every prompt:
- **35mm film grain, muted low-contrast pastel grade, soft cool daylight** (or soft window light indoors).
- **Very shallow depth of field, tight off-centre crops, something soft in the foreground** (marigold strings, a steel
  glass, a jasmine string, a shoulder). This one change does the most.
- **Candid and deadpan.** Nobody performs for the camera; small gestures (a finger on the lips, a hand on the head).
- **Lens per shot:** 35mm place, 50mm people, 85mm faces / long-lens compression, macro for product.
- **A memory / flashback:** same film, warmer and hazier, like an old photograph.
- **The product is the only rich colour in the frame** (the maroon Team Mithai box in a pale world).
- Never write "cinematic", "8K", "ultra-detailed", "mist", or stack light sources. Name ONE motivated light.
- Reference films are study only: keep their stills in a scratch folder, never put them on a client board.

## 4. Product truth (the thing clients notice first)

- **Product geometry comes from real photos only** (the client's site / Shopify JSON, or the best real shop in the
  category), never the client's AI renders. For mithai the bar is **Anand Sweets**: "premium but homely".
- **Spell out true size and shape in every prompt.** Kaju katli = thin elongated diamond ~4-5 cm, both points visible,
  matte. Motichur laddu ~4 cm, orange-gold boondi pearls, one cashew. Gulab jamun / rasgulla ~3 cm, bite-size. Hero box
  ~20 x 15 x 5 cm. The founder rejected oversized sweets three times; check size against a hand in every frame.
- **Real boxes:** packed full, edge to edge, no box floor showing, nothing stacked on top, one sweet per section, hand-cut
  and slightly uneven, never a checkerboard of identical pieces. Don't repeat the hero sweets in other people's boxes.
- **Only the client's real range.** No invented products ("shrikhand cups in a box is not a real thing").
- **When a reference uses another product, translate its truth, don't copy it:** a perfume ad presses notes into the
  bottle because a perfume *is* its notes; a hair oil becomes a cold press with real herbs. Write that reasoning into the
  brief and prompt.
- **Brief guardrails:** no comparison with chocolate or other brands, no product claims the client hasn't given
  ("pure" stays in the character's words, not ours).

## 5. Music, sound and the edit

- **Cut the music to the words.** Cheesecake reel: the founder wanted the track to start exactly on the sung "sabor" hit
  (found at 21.32 s), not on bar 1. Listen-points come from the founder; then line the cut up in code.
- **End plain, on a beat.** "No gimmick needed": no echo tails, risers or sweeps added on the end; cut on a beat.
- **CTA:** minimal, in the serif, one keyword in a contrast colour in quotes (Comment "FOOD", FOOD in gold).
- **Trending IG sounds are added in the Instagram app**, never ripped into our file.
- **One point per reel.** One topic explained properly beats a list.

## 6. Typography for client-facing boards

- Founder, 2026-10-16: fonts must be "really, really premium". System fonts (Georgia, Segoe UI) read cheap.
- What passed: **Cormorant Garamond** (display title ~220 px, italic tagline, story and notes) + **Jost** (tracked
  uppercase labels, small captions, Regular not Light so it reads on a phone). Both OFL, free for commercial use, from
  github.com/google/fonts; kept in `social/mithai/fonts/`. PIL loads the variable weights with `set_variation_by_name`.
- Palette from the frames plus the brand colour; gold for labels and numbers, brand maroon for the title.

## 7. Tool notes (ChatGPT, ComfyUI, downloads)

- **ChatGPT prompt entry:** `document.execCommand('insertText')` into `.ProseMirror`, then click `button[aria-label="Send"]`.
  Keep both as page helpers (`sendP`, `dlLast`) and re-create them after every reload.
- **Downloading the newest image:** fetch the last `img[alt^="Generated image"]` blob in the page and trigger an
  `<a download>`; the file often lands in `~/Downloads` as a `.tmp`. Match it by exact byte size and `-mmin -5`, then
  *look at it*: other threads' downloads land in the same folder.
- **Waiting:** a frame takes ~60-75 s. Poll "Stop streaming" absent before downloading; a long JS wait times out the tab.
- **Attaching references:** the file input "Attach photos" takes several files at once (under 10 MB total).
- Long chats sometimes fail to reload; start a fresh chat and re-attach the approved references.
- Bash heredocs mangle Windows paths with backslashes (`\b`); write Python with raw strings into a script file.
- Claude in Chrome: always the BCON Club browser (deviceId `f28429cc...`); check `list_connected_browsers` first.
- ComfyUI cost guide (2026-10): Hailuo 768P 6 s ≈ $0.28; Kling 3.0 720p std 5 s ≈ $0.42; Seedance 2.5 480p 5 s ≈ $0.6,
  720p ≈ $1.67. Spend log: `comfyAPI.api.api.fetchApi('/billing/events?page=1&limit=100')` (211 credits = $1).

## 8. Working with other threads

- ARC Studio uploads and attaches boards to ideas; Social EDITR hands files over in `ARC/.tmp-refs/<client>/` and does not
  upload to storage itself.
- Insta Deamon (scout thread) logs reference reels in `EDITR/content/social/REFERENCE-REELS.md`; ask it what to make next.
- Founder messages sometimes land in the wrong thread: if something has no trace in our repos, ask before acting.

## Where the detail lives

- Team Mithai log, all versions and corrections: `EDITR/content/clients/team-mithai/STORYBOARDS.md`
- How real mithai and boxes look: `EDITR/content/clients/team-mithai/MITHAI_REAL_LOOK.md`
- Social reel rules, formats, cost table: `EDITR/SOCIAL-EDITR.md`; shared agent lessons: `EDITR/LEARNINGS.md`
- Boards and scripts: `social/mithai/haldi3/` (Haldi v3 + moodboard.py), `social/mithai/dadi/` (Dadi ke Laddoo + moodboard.py)
