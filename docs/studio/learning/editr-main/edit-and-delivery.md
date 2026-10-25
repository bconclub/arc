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
