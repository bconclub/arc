# The pipeline and the tools (thread "Social Editr", 2026-10-25)

## 1. Stills (ChatGPT image generation, $0)
- Write every still prompt in blocks, the same words every time for a series: **LOOK** (real photograph, named camera
  or film stock, lens in mm, ONE light source, grade, real texture), **PLACE**, **CAST** (exact clothes and hair, repeated
  word for word), **PRODUCT** (its real shape, size, colour), **IMAGE n** (shot size, angle, lens, action, light),
  **AVOID** (CGI look, plastic, HDR, glow, neon, warped fingers, text, logos). Full house template:
  `docs/studio/storyboard-prompting.md`.
- Keep one chat per project so the look carries over; attach the approved still or official product photos as the
  reference ("use them ONLY for the car's exact design").
- 9:16 comes out 941x1672; 16:9 is 1672x941.
- ChatGPT blocks a car described too close to a real brand in some contexts; attaching official photos as a design
  reference worked for the Tesla Roadster.

## 2. Motion (ComfyUI Cloud)
- Model choice: Kling 3.0 for most shots; Seedance 2.5 for thick, oozy textures; Hailuo for the cheapest tests.
- Prices seen (211 credits = $1): Kling 3.0 720p std $0.42 / 5s, 1080p $0.56; Hailuo 768P ~$0.23; Seedance 480p
  $0.59-0.74, 720p ~$1.67. A full 10-shot ad ≈ $11 on Kling 1080p.
- **First frame → last frame** between approved stills beats one long move; short moves between real keyframes
  hold physics. Keep the subject facing the same way in every keyframe.
- Check every take on a 4 fps strip (`ffmpeg -vf fps=4,scale=180:-1,tile=10x1`) for warps, duplicates, melting.
- After cancelling, check the queue is really empty. An empty queue with no job means no credits (402).

## 3. Music, voice, sound (ElevenLabs)
- Music v2.5: set the duration before generating (adding custom lyrics switched it to Auto and gave 2-3 minute tracks
  at 900 credits/min). Lyrics like "na na na" sit in the lyrics box, the description in the prompt box.
- Pick the section of the track that fits: find the drop and the tempo, start so the drop lands on a cut, and if the
  track runs out, repeat whole bars inside the same section (never jump to a different section).

## 4. Edit (ffmpeg + Python, or code)
- ffmpeg cut scripts per reel (trim, concat, drawtext for titles, overlays); always check frame 0 and the end frame.
- Code-rendered scenes (title cards, phone UIs, kinetic type) render with our puppeteer renderer: see code-films.md.
- Screen recordings of web apps: puppeteer at 390x844 @3x with touch swipes and a CDP screencast (ARC teaser).

## 5. Delivery
- Drive only when done or Z says so. Upload through Chrome: patch `HTMLInputElement.prototype.click` to capture Drive's
  file input, inject our own input + `file_upload` (≤ 10 MB), click New → File upload, set the captured input's files and
  dispatch `change`. Synthetic drop events no longer work.

## 6. Quirks worth knowing (all hit for real)
- Several threads share one Chrome and one ChatGPT account: the new-chat draft box is shared (save and restore
  anyone's draft you find there), tabs can be pulled into other chats, and other threads download into ~/Downloads
  at the same moment. **Match a download by the exact byte size of the image** (`fetch(img.src).blob().size`), never by
  "newest file", and look at every saved file before using it.
- ChatGPT: use the image's own "Share generated image" button → Download (a plain "Share" only shares the prompt).
- Instagram blocks multiple downloads per page; route images through a localhost receiver via `postMessage` if needed.
- Instagram reels are easiest to study frame by frame by seeking the `<video>` element and screenshotting.
