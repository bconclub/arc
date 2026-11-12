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

## Checking clips (added 2026-11-02)
Contact sheets at six frames miss things. On Ep 1 an IEA logo faded in mid-shot and a large, faint ETV watermark sat over the aerials; both only showed on
the cut's 2-second strip. Check the strip of every cut, and look at candidate windows before re-rendering. Stock channels on the CC filter often carry a
big watermark ("footageonline"), and travel clips can carry their own title, so test the exact seconds you use.

## Voice and music on Ep 1 (added 2026-11-02)
- One take, split on `silencedetect` at 0.18 s into its 20 sentences (`voice/build_voice.py`). Each sentence is placed on its own, so holds can be added before the closing question. Everything else reads those times: cuts, receipt lines, subtitles.
- Check the words with the cached `faster_whisper` small.en model (`local_files_only=True`). It confirms the take says the script before any cutting.
- ElevenLabs duration field: click it, End, Backspace twice, type the seconds, Return. Typing over the whole value or setting it from JS reverts to the old length.
- Two tracks from one brief can differ by 5 dB. Hold each to the same quiet level (-34 LUFS here) so the founder picks by ear, not by loudness. Limit at 0.7 after the film gain: 0.84 peaked at -0.4 dBFS after AAC.

## Framing and real data: The AI Bill (added 2026-11-02)
Founder on the first Ep 1 cut: "Use actual data", and asking "who's paying?" then answering "Meta" makes it feel like Meta pays for everything. What we changed:
- Never let an answer sit straight after a question unless it is the whole answer. Read each line for what it implies, not only what it says.
- Labels are claims. "CHARGED TO SHAREHOLDERS" was our conclusion, so it went. Print what a source states, in its terms: "planned", "up to", "free cash flow", "market monitor says".
- Numbers come from filings first (SEC 8-K exhibits, company releases), press only when no filing exists. Add only like with like: one line item, one period. Plans stay out of totals.
- A claim with no source tying it to the story is cut, however good it sounds (Microsoft buyouts).
Format that came from this: **The AI Bill**, a dated weekly bill (Bill No. 001, 26 Oct - 1 Nov 2026). `EDITR/content/forward-slash/the-ai-bill/`: one JSON per week in `bills/`, `make_bill.py` asserts the total matches its items before rendering.

## Checking before anyone sees it (added 2026-11-02, founder: "double-check and triple-check")
- Numbers: re-add from the filing's exact millions, in code. Words: transcribe the finished mix, not only the take. Picture: a frame every second across the whole film, and every 0.3 s around any fix. Sound: LUFS and peak on each export.
- On The AI Bill this caught, in order: a worker's face with his name on his helmet, a client's site plan sliding in, and a brand logo, all inside clips that looked clean on the contact sheet. Sheets show moments; stock and news clips cut and overlay between them. Pin each clip's safe seconds in the shot list with a comment.
- Label generic footage on screen ("illustrative footage, not the companies' sites") so a building never reads as the named company's.

## Breaking-news life montage in ~2 hours (added 2026-11-12, forward slash "Jensen Huang is out")
- Build order the founder asked for: music + theme + a base cut with labelled footage slots first ("put the base up"), then
  drop real clips into the slots. The base shows him timing, type and the arc before any footage exists.
- Real footage only: a sourcing agent pulls 5-25 s sections with yt-dlp (<=720p, audio kept), logs sources.csv, rates
  clips 1-5, checks every bite's words with faster-whisper. Childhood photos rarely exist as real footage; use period
  archive film and say so in the credit, never AI or animated explainers.
- Engine (EDITR content/forward-slash/jensen): edit.py = shots/slams/years/caps/bites on the music grid; cut.py cuts
  24 fps JPGs per shot; ui/montage.html seek(t) page; mix.py = one music track at fixed gain, bites normalised to
  -14 LUFS (~8 dB over the music, no ducking), CC0 SFX on cues. `sync()` locks picture to a bite so lips match.
- What made it a montage: a year odometer (1963 -> 2026) with one-line captions, Anton slams on every phrase hit, white
  flash + shake on drops, a breakdown where the music falls away for the most human bite ("pain and suffering"),
  then the impact on the news. Three hooks share one body: render the body once, render only 0-3.5 s per hook.
- Facts: the company's own wording ("resigned") on screen; anything from press only as "reports" / "alleged".
- Music: ElevenLabs Edit Song took a 49.5 s take with a long fade to 42 s ending on one hard hit (ask for section
  lengths + "no fade-out, no new section").

### Year cards are spoken by real narrators (Jensen v03, 12 Nov 2026)
- Founder: on-screen timeline text only lands when a voice says it. No generated narration (not even his clone) in a real-footage montage: use the real narrators.
- Pull the FULL audio of the long-form docs already in the edit (60 Minutes, Bloomberg Originals), transcribe with faster-whisper, grep for the card facts. Bloomberg's "born in Taiwan in 1963, moved to the US" and 60 Minutes' "worked as a dishwasher at Denny's" matched the cards word for word. Anchors on milestone clips (CNBC $1T, BBC "first ever company to $5 trillion") voice the money cards.
- Lay each line on its cut (8th-note grid from the impact), card + line start together; drop cards nobody says. atempo up to 1.12 is fine to fit an anchor line.
- Credits: just the outlet's @handle (or the name if no verified handle), small, bottom-left, below the ticker. No "COURTESY" word, no dates.
