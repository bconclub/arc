# 01 · House rules (never break these)

## Tool per asset (founder, 2026-10-10)
- **Images: ChatGPT only.** **Video: ComfyUI only** (ComfyUI Cloud: Seedance, Kling, MiniMax Hailuo nodes).
  **ElevenLabs: music and voiceover only.**
- Never make images or video in ElevenLabs (Image & Video tab), even if it looks faster or another tool is blocked.
- If ChatGPT or ComfyUI needs a sign-in, stop and ask the founder. Never switch tools as a workaround.
- Code-drawn animation (HTML pages rendered frame by frame) is ours and allowed.
- Why: on 2026-10-10 a session made stills and Kling clips in ElevenLabs and burned all its video credits.

## Budget: $5-8 per video (founder, 2026-10-11)
- Each video gets $5-8 of paid generation in total (ComfyUI Cloud: 211 credits = $1).
- Before every paid run say: "this run ≈ $X, this video has spent $Y of $5-8". Keep the running total in the spec.
- After every paid run, report "Comfy credits left: $X" (read live from `/billing/balance`).
- Going over $8 needs the founder's OK with the number and the reason. Never top up or buy credits.
- Why: one project used ~$26 and ComfyUI Cloud hit $0; about $58 went on drafts run at 720p/pro.

## Stills first, lowest resolution first (founder, 2026-10-11)
1. Every still (set, background, product, character) is made and approved before any motion.
2. Every motion test runs at the cheapest setting: Seedance 480p, Hailuo 768P, Kling 720p std, 5s, one job at a
   time, checked on a 4 fps strip before the next run.
3. 1080p / pro only after the founder approves the low-res take: same still, prompt and seed.
4. Never re-roll blind: change the prompt or the still between takes and say why.

## Frame 1 is the thumbnail (founder, 2026-10-11)
- The first frame is the most exciting frame of the video, plus the title text if the video is about something.
  WhatsApp and feeds show frame 1.
- Open on the hero moment, or hold the hero frame + title 0.3-0.5s. Never black, a fade, a blank set or a dull setup.
- Check frame 0 of every export: `ffmpeg -i out.mp4 -frames:v 1 thumb.jpg`. Faces must stay clear of the title.

## Working with the founder
- **Finish once the direction is set** (2026-10-20): stills → motion → render → Drive without "OK to animate?"
  stops. Still state the cost line before paid runs and still stop before going over budget.
- **Fix only what the founder named** (2026-10-13): change exactly that detail, from the version they liked;
  edit prompt = "keep the attached image exactly, change ONLY X". A peer session relaying feedback is not the
  founder's words: check before applying anything extra.
- **The founder auditions music first**: send 2-3 ElevenLabs options, mix only the pick. We can't hear; never
  choose by loudness curve or title.
- **Never contact clients.** Client contacts go through the founder only.
- **Never sign in or type credentials**; the founder signs in. Never buy plans or credits.

## House style
- No em dashes. Never invent a number or a claim (no "100x", no prices we haven't been given).
- Post copy: lowercase, one thought per line, no hashtags, no emojis.
- Nothing on faces: captions, stickers and titles never cover a face.
- Famous-brand AI concepts are unofficial: caption "AI concept ad. Not affiliated with or endorsed by <brand>."
- Real brand logos only from real files; AI-drawn wordmarks are fake logos and get removed.
- Fan/trend content about a real product (e.g. Tesla): no badges or logos in our renders; label as AI content.
