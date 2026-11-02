# Documentary films: Manipur and frwdslash (written 2026-11-02)

The format: a 45 s dated documentary with one calm voice, real footage, newspaper cuttings and a closing question.
Manipur (T23, `C:\dev\tools\ai-video\videos\manipur-as-it-is\`) set it. frwdslash Ep 1 "Who is paying for the AI boom?"
(`C:\dev\builds\EDITR\content\forward-slash\who-is-paying\`) is the first one on AI and companies.

## Order
1. Scan what is actually happening, keep story leads with links (`EDITR/content/forward-slash/world-scan-*.md`).
2. Open every source yourself. Quote the headline and number exactly; note who said it and the date. Conflicting figures
   stay out or get attributed. Write a script where each line has its source beside it.
3. Treatment doc for the founder: script, shot plan, look, facts still to close, decisions needed.
4. Studio open on localhost:4401 before any work ([house-rules.md](house-rules.md) rule 10).
5. Voice first, then two music options; the voice pauses set every cut. **Read the ElevenLabs balance before promising
   this step:** on 2026-11-02 it had 10 credits with renewal 7 days away.
6. Footage, code layer, cut, frame 0 and strip checks, then 1080p after approval.

## Footage: real first
- Search YouTube's Creative Commons filter with `yt-dlp` (`sp=EgIwAQ==`), one query per beat, list only. Scripts:
  `manipur-as-it-is/archive/search_cc.py`, `pull.py`. `pull.py` writes date, licence, channel and URL to `sources.csv`.
- Contact-sheet every clip before choosing (`who-is-paying/qa/sheets.py`, six labelled frames per clip).
- Leave out: burned-in watermarks that can't be cropped, identifiable private people, anything that implies a named
  person did what the line says. Crop channel bugs and captions. "CC" on a news channel may still carry agency footage,
  and stock channels may upload computer-generated clips, so rights stay "not cleared" until someone clears them.
- Generated images only for real gaps: really few, small watermark, shown to the founder before motion.

## One visual rule
Ep 1 uses a receipt. Each payer prints as a line, lime marks the line being charged, the pictures stop on "the question
remains" and the camera moves in on TOTAL: ?. It comes from reference 7 (one visual rule holding many images together).
A rule like this keeps many clips from different sources feeling like one film, and sources can sit on the receipt itself.

## Build
- `beats.py`: the script and line times, one place. Estimates at 2.4 words a second until `voice/lines.json` exists.
- `ui/receipt.html`: every frame a pure function of t (`__seek`), transparent PNGs rendered over CDP (`anim/render.mjs`),
  with `?m=1` for the 9:16 layout. Cuttings land fast from slightly bigger, as on Manipur.
- `cut.py`: a shot list keyed to voice lines, each shot rendered to counted frames, concat, then the receipt layer on top.
  Each shot carries a focus point for 9:16, and the receipt moves to the upper half with subtitles under it.
- Silent review cuts carry the script as subtitles so the founder can judge the story without a voice.
- Python scripts that import a sibling file can't run with `-I`; keep `-I` for files handling downloads.
- Pipelines in a shell: `set -o pipefail`, otherwise `| tail` hides a failure and a "done" log line lies.

## Words
Numbers as words in the voice. A question mark on a line where the source doesn't make the claim (WORKERS?, because
Microsoft hasn't tied the buyouts to AI). Label who pays with the source's word: "ratepayers" became CUSTOMERS, not
HOUSEHOLDS. A caption says it is commentary from public reporting. Active court matters get a legal read before posting.

## Manipur notes from the founder
Music overpowering the voice was the first complaint: one low fixed gain (.22). Real video wherever possible. No
artificial pitch or volume steps, compose any rise in ElevenLabs. Animate everything, every shot moves.
