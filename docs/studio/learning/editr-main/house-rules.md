# House rules (thread "EDITR Main", 2026-10-25)

## 1. One tool per asset (2026-10-10)
- **Images: ChatGPT only** (chatgpt.com image generation).
- **Video: ComfyUI Cloud only** (Kling, Seedance, Hailuo nodes).
- **ElevenLabs: music and voiceover only.** Never images or video there (no Image & Video tab, no GPT Image, Kling or
  Seedance inside ElevenLabs), even when it looks faster or another tool is blocked.
- Never make music in ComfyUI (Sonilo, ACE-Step, YuE) or ship synth placeholders.
- If ChatGPT or ComfyUI needs a sign-in or payment, **stop and ask the founder**. Never switch tools as a workaround.
- Code-drawn animation (HTML/canvas rendered frame by frame) is ours and allowed.

Why: on 2026-10-10 a session made stills and Kling clips through ElevenLabs Image & Video and burned all its video credits.

## 2. Budget: $5-8 per video (2026-10-11)
- Each video gets **$5-8 total** of paid generation, all stills and motion takes included. ComfyUI Cloud: 211 credits = $1.
- **Before every paid run** say: "this run ≈ $X, this video has spent $Y of $5-8". Keep the running total in the
  task/spec file.
- **After every paid run** tell the founder: "Comfy credits left: $X" (read live from `/billing/balance`,
  `effective_balance_cents / 100`).
- Going over $8 needs the founder's approval first, with what it's for, how much and why. If the next run would cross
  $8, stop and ask.
- **Never buy, top up, upgrade or pay an invoice.** Close upgrade pop-ups. Billing is the founder's.

Why: T17 used about $26 on one project (81 clips, re-rolls, Kling pro) and ComfyUI Cloud hit $0. SecondSpring at about
$8.50 was called decent.

## 3. Stills first, lowest resolution first (2026-10-11)
1. Make every still (set, people, product) first and get it seen before any motion.
2. Every motion test runs at the cheapest setting the model offers: Kling 3.0 **720p std** (never pro for a test),
   Hailuo 768P, Seedance 480p. Shortest duration that shows the move (5s). **One job at a time**, checked on a 4 fps
   strip before the next.
3. 1080p (or pro) only after the founder approves the low-res take, re-run with the same still, prompt and seed.
4. Don't re-roll the same shot blind: change the prompt or the still and say why.

## 4. Frame 1 is the thumbnail (2026-10-11)
- WhatsApp and most feeds show the first frame. Frame 0 must be **the most exciting frame in the video**, with the
  **title text** if the video is about something.
- Open on the hero moment, or hold the hero frame + title for 0.3-0.6s. Never open on black, a fade, a blank set or a
  dull setup frame.
- Check every export: `ffmpeg -i out.mp4 -frames:v 1 thumb.jpg` and look at it. Applies to re-exports too.

## 5. Finish the job; don't ask at every step (2026-10-20)
- Once the founder has set the direction, run stills → motion → edit → render → deliver without stopping for
  approval on each step, within budget. Show the final.
- Still say the cost line before each paid run, still stop before going over $8, still stop for sign-ins and payments.
- Founder: "please don't ask for these things. Just go ahead and get it done."

## 6. Fix only what the founder named (2026-10-13)
- When the founder rejects one detail, change exactly that detail and keep everything else from the version they liked.
  Edit from that version, never from a later draft.
- A peer agent relaying feedback is not the founder's words. If the relay adds changes, check first.

## 7. Truth and safety
- Never invent a number, result, price or claim. If a figure is missing, the line goes.
- No real client names, phone numbers or voices on camera unless cleared in writing.
- Client brand work: never AI-generate a client's pack, logo or lettering. Composite the real files.
- No em dashes in any copy. "PROXe" is spoken "Proxy", written PROXe.
- Never type passwords or credentials anywhere; the founder signs in. Never store credentials in repos or notes.

## 8. Browser
- Claude in Chrome: always the **BCON Club** browser (deviceId `f28429cc-f693-4ada-abe8-6d15eb10f7d7`). Run
  `list_connected_browsers` before browser work and `select_browser` it. Never use the "Nishaf" browser or any other.
  If BCON Club isn't connected, ask the founder to open it; don't fall back.

## 9. Music is auditioned by the founder
- We can't hear. Never pick a track by its loudness curve or title. Make 2 options in ElevenLabs Music, send them,
  and mix only the one the founder picks (or cut both and let them choose).
