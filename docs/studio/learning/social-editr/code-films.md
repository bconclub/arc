# Code-rendered films (thread "Social Editr", 2026-10-25)

Z shared 8 GitHub repos on making videos with Opus 5.5 ("this is your skill upgrade"). All were studied read-only on
2026-10-21; full write-up in the EDITR repo: `content/social/SKILL-UPGRADE-code-films.md`. Clones (not run):
`C:\dev\builds\social\_learn\repos\<owner>_<repo>\`.

## The one big finding
Every viral "Opus video" is the same method: Claude writes one HTML page (Canvas 2D / SVG / three.js / WebGL / p5)
where **every frame is a pure function of time**; a headless browser screenshots each frame; ffmpeg encodes. Our
renderer (`EDITR social/mods/render.mjs`, page exposes `window.__seek(t)` + `window.__duration`) already does this.
It costs $0, is frame-accurate, and suits kinetic type, charts, UI demos, explainers and brand templates.

## The repos and what to take
| Repo | Take | Avoid |
|---|---|---|
| yihui-dev/awesome-opus5-5-videos | 703 viral prompts: storyboard first, banned lists, beat grids | some prompts edit `~/.claude` settings or point at API keys; prompts belong to creators |
| athemeroy/awesome-claude-5-5-videos | research atlas, 7 prompt templates (9:16 code short, promo from own assets) | its scripts (one scrapes X via a live Chrome) |
| joeseesun/opus-video-prompts | 30s business explainer, talking-head to PiP + line-art | no licence: reference only |
| lemomo-ai/lemo-opuscar | directing method, 51 styles (swiss-motion, dark-keynote, glass-product, hologram-hud...) | **don't install**: auto-updates itself from upstream, WSL-only, all styles 16:9 |
| mexicat/pdoom-video | word/syllable-timed lyrics, cuts snapped to beats, karaoke rules | the song is not licensed; Mac-tuned |
| JohnHeibel/PDoomVideo | simple Windows-native renderer, contact-sheet QA | no licence |
| Vincentwei1021/mg-styles-15 | 15 MG styles with source; 18-hanazi pop captions (9:16), easing/spring lib, explainer grammar | fonts not included |
| JohnHeibel/ClaudeAnimationBase | code-drawn character with 31 emotions; swap in a brand mascot (~1-2 days) | the character is Anthropic's mascot Clawd: never in client work |

## Method we adopt
1. Storyboard first (6-8 shots with timing, subject, action, caption, transition).
2. Prompt in blocks: inputs / direction / timecoded structure / build / gotchas / banned list.
3. Purity: everything computed from `t`; no CSS transitions, timers, `Date.now()`, unseeded random; load every font
   weight before ready.
4. Timing: hook inside 0.5-3s; cuts on a beat grid; 2-4 frame staggers; hero moment at 60-75%; end held 0.8-1.2s.
5. Motion: named curves only (snap `cubic-bezier(.7,0,.2,1)`, overshoot `(.34,1.56,.64,1)` or a closed-form spring);
   nothing just fades: wipes, clip reveals, knife cuts.
6. One accent colour for the hero; captions fitted to the 9:16 safe zone; one type family; text on screen at least
   letters/15 + 1.5 s.
7. QA before the full render: render a contact sheet or one frame per beat, look, fix, then render.
8. Finish in ffmpeg: grain there (not in the page), loudness -14 LUFS, optional motion blur from averaged sub-frames.

## Kit to build next ($0, ~1-2 days)
Renderer upgrades (workers, preview sheets, motion blur, reading-time check, mux), a shared lib (easing, springs,
pop captions, word-timed karaoke), 9:16 rewrites of ~8 styles, and a house prompt template.
