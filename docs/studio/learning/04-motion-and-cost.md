# 04 · Motion (ComfyUI) and what it costs

## The method
- Design every key moment as an approved still, then animate **first frame → last frame**. The model only fills
  the gap.
- **Short moves between real keyframes beat one long move.** One street-to-space zoom invented a fake horizon; a
  still per height plus 5s moves between them, joined with speed ramps, worked.
- If a cheap take breaks, fix the setup (frames, prompt, a shorter move) before upgrading the model.
- Check every take on a 4 fps strip (`ffmpeg -i take.mp4 -vf fps=4,scale=180:-1,tile=10x1 strip.jpg`): reject
  warped labels, bending or melting products, duplicates, swaps, faces that change. Skip frames that fail.
- For an end state that must be exact (a logo, a final pose), make that still and use it as the last frame.
- Don't `minterpolate` AI clips to change fps; keep the source fps or generate at the film's fps.
- Photo scenes must move: a still with a slow zoom was rejected as a final.

## Which model (costs from ComfyUI `/billing/events`, 211 credits = $1)
| Model | Lowest test | Final | Good for |
|---|---|---|---|
| MiniMax Hailuo 02 | 768P 6s ≈ $0.28 | 1080P 6s ≈ $0.49 | Cheapest tests, first-last morph loops |
| Kling 3.0 (kling-v3 node) | 720p std, $0.084/s ≈ $0.42 per 5s | 1080p (pro) ≈ $0.56 per 5s | Most shots; real physical action (a real crush) |
| Seedance 2.5 | 480p ≈ $0.59-0.74 | 720p ≈ $1.67; 1080p ≈ $3.75 (estimate) | Thick textures, reference-to-video with product images, consistent people |
- The plain Kling image-to-video node now only offers v2.5 turbo **pro**; use the "Kling 3.0 Video" node for std tests.
- A 10-shot ad at ~2 takes per shot ≈ $11 on Kling 1080p: over budget, so plan fewer, better shots.
- Rough reel costs: keyframe-morph fashion loop ≈ $1.5-2; a 3-clip trend stunt ≈ $4-6.

## Running ComfyUI Cloud safely
- One job at a time, ~6s apart; check it landed. A silent 0/0 queue means a 402 "insufficient credits".
- Cancels don't always stick: re-read `/queue` until it's empty.
- Uploads go through `comfyAPI.api.api.fetchApi('/upload/image')`; LoadImage uses the hashed name it returns.
- Partner nodes (Kling, MiniMax) only queue through `app.queuePrompt` (needs the UI login token).
- Spend audit: `fetchApi('/billing/events?page=N&limit=100')`; balance: `fetchApi('/billing/balance')` →
  `effective_balance_cents / 100`.

## Code-rendered films ($0)
When the idea is type, UI, graphics or a board (prompt reveal, cards board, explainers): one HTML page where every
frame is a pure function of `t` (`window.__seek(t)`), screenshotted headless, encoded with ffmpeg
(`social/mods/render.mjs` in EDITR). Rules: storyboard first, beat-grid timing, named easing, one accent colour,
contact-sheet QA before the full render, grain in ffmpeg. Full playbook: EDITR
`content/social/SKILL-UPGRADE-code-films.md`.
