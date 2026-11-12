# Edit and delivery

## The edit is a script, not a timeline
`C:\dev\builds\zensquare_moodboard\build_preview.py` (stills animatic) and `build_final.py` (clips) are the template:
Python + PIL for text PNGs + ffmpeg. One `SHOTS` list = (still/clip, seconds, caption line 1, line 2); everything else
(thumbnail hold, crossfades, end card, mix, two music masters, frame-0 grab) is generated. Re-running is cheap, so
changes are cheap. SecondSpring used the same shape (`secondspring_launch/build_animatic.py`, `final` flag for 1080p).

## Timeline rules
- **Frame 0:** hero image (campus clip frame 0 / hero still) + title, held 0.6s, then a 0.04s cut into shot 1. No fade-in.
- Shot lengths come from the VO pauses (see [sound.md](sound.md)); 0.4s crossfades between shots; end card holds to the
  end (~6s) under the last VO line ("Book a specialist consult with ZenSquare.").
- Clip longer than its slot: trim to the best seconds. Slot longer than the clip: slow with `setpts` up to ~1.2x
  (ZenSquare: 1.13-1.17x was invisible on gentle moves).
- 720p clips → `scale=1080:1920:flags=lanczos`. LEARNINGS says don't `minterpolate` AI clips (risk of warped faces);
  ZenSquare v03 used it for the slowed shots and strips looked clean, but prefer plain `fps=30` next time and check.

## Text
- Captions: two lines centred low (line 1 bold ~64px, line 2 regular ~46px), white with a soft blurred navy shadow,
  fading in 0.5s after the cut, matching the VO line. Never on a face.
- Use the brand font (ZenSquare: Plus Jakarta Sans). Segoe UI was a stand-in; it has no ★, so draw the star with
  Segoe UI Symbol (`seguisym.ttf`) or use the brand font. Check every glyph in a contact strip (we caught "A□").
- End card: brand gradient from the site CSS, the real white logo file, the program name, a white CTA pill
  ("Book a specialist consult"), the URL. Never an AI-drawn logo.

## QA before sending
```
ffmpeg -i out.mp4 -frames:v 1 frame0.jpg                                   # thumbnail
ffmpeg -i out.mp4 -vf "select='eq(n\,0)+eq(n\,100)+...',scale=270:480,tile=8x1" -frames:v 1 -vsync 0 strip.jpg
ffmpeg -i out.mp4 -af ebur128 -vn -f null -                                 # loudness (I: about -14)
```
Look at frame 0 and the strip (one frame per shot): right shot on the right line, captions legible, nothing on faces,
glyphs render, end card clean. Confirm duration (30.00s) and 1080x1920.

## Showing the founder
- `SendUserFile` the mp4s (they render in the chat). Also open them in the app's browser pane: the pane can't play
  `file://` video, so serve the folder: `.claude/launch.json` config running `python -m http.server 4455 --directory
  <folder>` + a small page with two `<video controls>` side by side (option 1 / option 2). Keep mp4s git-ignored.

## Delivery
- Drive: `Brands/<Brand>/<Project>/<Stage>/<Brand>_<Project>_<description>_v01.ext`; upload when done or when the founder
  says (over 10 MB: split + rebuild in the page, see [tools.md](tools.md)).
- ARC Studio: brand page with brief, palette, logo, notes (plan, prompts, script/music/cut, motion + spend, rules),
  stills with their exact prompts, and the film as a `video` item. Update it when a new version lands.
- Log spend and files in the spec; keep the founder's open questions at the top.

## Talking-head reel cut (real footage), read from two client references (2026-11-12)
Two finished flying-school reels (26 s and 69 s), measured from frames, cut detection and a faster-whisper transcript.
- **Tight voice track is the edit.** 180 to 190 words a minute, no gap between words over 0.42 s, speech starts at
  0.0 s. Pauses, breaths and retakes are cut out first; everything else hangs on that track.
- **Cut every 2 to 3 s**, faster in the first 12 s. Face shots run 2 to 5 s; cutaways 1 to 3 s.
- **Cutaway on the spoken noun:** the picture shows the thing as the word is said (a list of four items = four quick
  shots), then back to the face. B-roll is the client's own rooms and people; stock only for planes and airlines.
- **Captions:** style 1 = 1 to 2 bold words at a time, fixed low-centre, key word yellow. Style 2 = small white sans
  plus the key word in a gold italic serif, position moves with the shot.
- **Open:** title card on frame 0 (speaker cut out over topic images + the title) beats opening on a plain face.
- **Close:** spoken keyword CTA, then a 3 to 4 s brand end card with a button.
- **Our method:** faster-whisper word timings -> cut list (drop gaps over ~0.3 s and retakes) -> ffmpeg concat ->
  B-roll laid over by word time -> captions from the same word timings -> title + end card -> music + SFX.
  Same "edit is a script" shape as above; `shortform-video-editor` skill covers the silence cut and captions.

### First talking-head cut built this way (2026-11-12)
- Six 4K vertical takes (rotation flag 90), 25 fps: keep 25 fps in the export. One `build.py`: phrases split at word
  gaps over 0.35 s, each cut 0.06 s before the first word and 0.14 s after the last, alternate 1.0 / 1.14 punch-in per
  phrase so jump cuts read as intended.
- **B-roll boards (Playbook):** don't download 40 GB. Each asset carries a 10x10 preview sheet; pull those, tile four
  frames per clip into an overview, choose, then cut only the seconds needed straight from the signed link with
  `ffmpeg -ss T -i URL -t 3.6` (about 15 s per piece). Links expire daily.
- Captions as a PNG strip sequence from PIL (ffmpeg `drawtext` crashed on this PC: no fontconfig). Break chunks at
  conjunctions and punctuation, never across a sentence; keep them word-for-word with the voice.
- Sound pass the founder asked for: riser timed to END on the reveal word, big hit on it, whoosh 0.12 s before every
  B-roll cut-in, low hit on the title and end card, click on the button. Voice: highpass, light compression, -15 LUFS.
- Check the B-roll matches the claim: a reel about online classes with only offline classroom footage is a gap to
  raise, not to hide.

### Matching a client's house style (Windchasers, 2026-11-12)
Founder: v01 was "too bad", cut on instinct. Match their reels first, improve after. What fixed it:
- **Study the whole account, not one reel.** Pull every reel (Instagram profile grid logged out: close the pop-up,
  collect `/reel/` links + view counts; `yt-dlp` per reel), contact-sheet all of them by views, transcribe, count cuts.
  Duplicates are common (same edit posted twice); the top reel may be in another language (Telugu with English captions).
- **Read captions at 5-10 fps**, not from a 1 fps sheet. Windchasers: one short phrase per line, wiped in left to right
  (~0.3 s), held 1.2-2 s, carried across cuts; the emphasis words land later on a second line, bigger and gold
  (Playfair Display italic or Montserrat ExtraBold); inline key word in gold italic serif. White Montserrat SemiBold.
- **Hand-set the captions** from the word-index transcript (clip, from, to, key, second line, style). Auto chunking gave
  "Dream of becoming a / pilot".
- Warm light-leak burn to white on the cutaways in the hook (about every 4 s) and at section changes; first cutaway by
  ~2-3 s. End card: tan #C7B577, black logo, jets slide in, "ENQUIRE NOW" pill clicked.
- Fonts that match: Montserrat + Playfair Display Italic (Google Fonts, OFL), variable axes via PIL `set_variation_by_name`.
- AAC adds ~3 dB of true peak over the WAV: limit the final mix to ~0.70 before encoding.
- ffmpeg with 12+ inputs crashed silently here: lay the cutaways in one pass, the caption PNG sequence in a second.
