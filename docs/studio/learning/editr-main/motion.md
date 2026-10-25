# Motion: animating stills in ComfyUI Cloud

## Models and real prices (from ComfyUI `/billing/events`, 211 credits = $1)
| Model | Test setting | Price | Use it for |
|---|---|---|---|
| **Kling 3.0** (`KlingVideoNode`, model `kling-v3`) | 720p (std tier), 5s, 9:16, audio off | $0.084/s = **$0.42 per 5s** | Default for people and gentle moves. 1080p is the pro tier ($0.56/5s). |
| MiniMax Hailuo 02 | 768P, 6s | ~$0.23-0.28 | Cheapest tests; can morph faces in close-ups (never ship that) |
| Seedance 2.5 | 480p 5s | ~$0.59-0.74 (720p $1.67) | Thick/oozy textures Kling can't hold |
| Kling Avatar (pro) | still + audio | ~$1 per short line | Lip-sync from a front-facing still (SecondSpring opening) |
| Kling Lip Sync (audio to video) | 720p | ~$0.07 per 5s | Cheap lip-sync on real footage; en/zh only, weak on wide shots |

`KlingImage2VideoNode` now only offers v2.5-turbo pro: don't use it for tests. `KlingVideoNode` also lists
`kling-3.0-turbo` (price not checked yet).

## KlingVideoNode settings that work
`multi_shot` disabled · `multi_shot.prompt` (max ~512 chars) · `multi_shot.negative_prompt` · `multi_shot.duration` 5 ·
`generate_audio` false · `model` kling-v3 · `model.resolution` 720p · `model.aspect_ratio` 9:16 · `seed` fixed
(e.g. 20261024) with `control_after_generate` fixed. Graph: LoadImage → KlingVideoNode(start_frame) → SaveVideo.
Output: 720x1280, 24 fps, 121 frames (5.04s). One run takes about 2-4 minutes.

## Prompts that got 6/6 first takes (ZenSquare)
Pattern: **one small natural action + one slow camera move + "light stays steady" + "same person, same room"**.
- Study close-up: "She stays at her desk, eyes on the laptop just out of frame, slowly lowers the pen from her lip and
  nods slightly as she understands, then glances down to write. Very slow push-in. Soft evening window light from the
  left stays steady, the curtain moves gently."
- Over the shoulder: "On the laptop screen the tutor keeps explaining, gesturing toward the maths on her whiteboard...
  The girl writes in her notebook, then glances up at the screen. Camera almost static with a very slow push."
- Parent: "leans on the doorframe, slowly lifts the steel tumbler and takes a small sip of tea, lowers it and smiles
  softly... Camera static with slight natural handheld breathing."
- Walk: "walks forward along the stone path... books held against her chest, tote bag swinging slightly, ponytail
  moving with each step... Camera tracks backward at her walking pace, low angle, sun behind her."
- Negative for all: "morphing face, changing identity, different person, warped hands, extra fingers, readable text,
  letters, logos, flicker, fast camera move, sudden zoom, new people appearing, cartoon, CGI, plastic skin, blur".

## Checking a take
- Strip at 4 fps: `ffmpeg -i clip.mp4 -vf "fps=4,scale=144:-1,tile=10x2" -frames:v 1 strip.jpg`. Look at faces, hands,
  props (phones, pens), text on screens, and whether the action reads.
- Accept a take with a flawed part by **using only the good seconds**: ZenSquare k2 (a pen flip in the first second →
  used from 1.25s), k5 (her look-up read wistful, not proud → used 0-3.6s). Cheaper than a re-roll.
- If a take fails, change the prompt or the still, say why, then re-run. Never re-roll the same thing blind.

## Lip-sync (SecondSpring)
- The first-shot lip-sync was rejected twice. What fixed it: a new **front-facing** close-up still from ChatGPT, animated
  with **Kling Avatar Pro** (still + the line's audio). Mouth/speech match went from ~0 to clearly in sync.
- Don't start the narrator over a face that is talking; end the talking shot, then start the narration (0.2s gap).
- Kling Lip Sync on wide shots and non-English audio is poor; Kling Lip Sync needs audio of at least 2s (pad with silence).

## Spend log format (in the spec)
`2026-10-24 · k1 study (f1) · kling-v3 720p std 9:16 5s seed 20261024 · $0.42 · total $0.42 · accepted · left $34.05`
