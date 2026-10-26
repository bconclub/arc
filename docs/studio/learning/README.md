# Studio learning: how we make videos

Everything the studio agents (Insta Daemon, Social EDITR, EDITR Main, Linkedin EDITR, ARC Studio) have learned about
making reels, ads and films, in one place. The founder (Z) shares references; this folder is where the understanding
lands so any agent, on any machine, can pick it up.

Started 2026-10-25 by Insta Daemon from the EDITR repo (`SOCIAL-EDITR.md`, `LEARNINGS.md`,
`content/social/REFERENCE-REELS.md`, `AUDIO-LIBRARY.md`, the code-films playbook), the agents' memory rules, and the
live jobs (Team Mithai, Calvary "The Chai", Tesla trend, Coca-Cola, mods reel).

## Read in this order
| File | What it covers |
|---|---|
| [01-house-rules.md](01-house-rules.md) | The hard rules: tool per asset, budget, frame 1, stills first, how to work with the founder |
| [02-references.md](02-references.md) | How to study a reference and turn it into our idea; the formats that work, by brand type |
| [03-stills.md](03-stills.md) | Prompting stills that look real: A-F blocks, camera, light, product truth, vehicles, physics |
| [04-motion-and-cost.md](04-motion-and-cost.md) | Stills to motion: models, prices, low-res tests, first-last frames, checking takes |
| [05-edit-text-sound.md](05-edit-text-sound.md) | The cut: hook, captions, safe zones, end cards, music, voice, editing a client's real footage |
| [06-tools.md](06-tools.md) | How to pull a reel, analyse audio, split shots, drive ChatGPT / ComfyUI / ElevenLabs / Drive |
| [07-founder-feedback.md](07-founder-feedback.md) | Dated corrections from the founder, in their words, and what changed |

## Other agents' sections
- [`editr-main/`](editr-main/README.md): EDITR Main (launch films and client ads, ZenSquare and SecondSpring): house rules, launch-film pipeline, stills and realism, motion and prices, sound, edit and delivery, tools, brands, founder feedback.
- [`proxe-editor/`](proxe-editor/README.md): PROXe editor (PROXe UK ads): UGC industry ads, stills realism, Seedance/Kling
  lip-sync and prices, reusing the PROXe V1/Brain pieces, voice, tool quirks, founder feedback.
Files 01-07 above are Insta Daemon's (references, social reels, Calvary, Tesla trend).

The storyboard standard (six 9:16 frames, prompt blocks A-F, the check table) stays in
[`../storyboard-prompting.md`](../storyboard-prompting.md); 03-stills.md builds on it.

## Where the detail lives (EDITR repo, `C:\dev\builds\EDITR`)
- Every reference breakdown (25 so far): `content/social/REFERENCE-REELS.md`, indexed by brand type.
- Every reference's sound + measured analysis: `content/social/AUDIO-LIBRARY.md`.
- One spec per reel: `content/social/<date>-<reel>.md`. Client work: `content/clients/<brand>/`.
- Agent-to-agent lessons: `LEARNINGS.md`. Social rules + changelog: `SOCIAL-EDITR.md`.

## Keeping this current
- When the founder corrects us, add the quote and the change to `07-founder-feedback.md`, and move the rule into
  the right file. Newest first. Date every line.
- When a new reference teaches a new format, add one line to the format table in `02-references.md` (the full
  breakdown stays in EDITR's REFERENCE-REELS.md).
- No em dashes, no invented numbers (house style).
