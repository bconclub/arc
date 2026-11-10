# Today in AI: the daily show (forward slash, started 2026-11-02)

Founder: a series that goes out every day, each edition covering the day before. "We need a proper start, a proper end, a jingle, one proper voice, the way they talk, end to end."
Before it: Who Is Paying (dropped, framing), The AI Bill ("I don't think this is working").

## Format
Open card with jingle and date, three stories, close card with jingle. Voice: our own designed voice (see below), not a news anchor. Light paper, Inter, the forward slash gradient on the slash and one accent per story. Type on paper, no stock footage: no rights to clear, and it can ship daily.

## Daily routine (`EDITR/content/forward-slash/today-in-ai/`)
1. Find what happened yesterday. Aggregators only point; read the original. Save quotes and links in `editions/<date>.md`, with what was dropped and why.
2. Write one script: open, three stories, close. About 110 words. Attribute everything ("Axios reports"). A paywalled source: use only the part you read.
3. Voice in ElevenLabs, check chip and text first. Save to `voice/`, run `beats.py`: quickens 6%, transcribes word times, cues every graphic. Read the printed words against the script.
4. Edit the story cards in `ui/film.html`, render with `cut.py`, sound with `mix.py`. Jingle and theme are reused, so sound costs no credits daily; only the voice does (about 700).
5. Check: frame at each cue, transcribe the final mix, LUFS and peak, frame 0.

## What bit us on the first edition
- Aggregators were wrong or stale: a Pope item, Abu Dhabi deals and OpenAI chips all failed at the source. Trust the date on the original only.
- A failed word match left old cues with new audio, so picture ran 0.8 s off the voice. The transcription can drop spoken numbers ("Three."); beats.py now restores them and stops if a cue is missing. Always stop the chain on failure.
- ElevenLabs ignored a 51 s setting on a theme (1:12). A long brief with two jingle moments doesn't land as a jingle; make the jingle its own 5 s piece.
- A page variable named `top` clashes with a browser global and gives blank frames. Check the first render.

## Voice and delivery (founder, 2026-11-02)
"If we say news like this, no one will hear." It has to sound like a creator talking to chat: "What's up, chat." And "we might have to prompt and create our own voice artist": the show gets a unique voice from ElevenLabs Voice Design, not a library voice.
- Voice Design: Voice Creation, Voice Design, turn off Generate Preview Text and paste the show's real lines, so the voice is judged on our words. About 312 credits for three previews.
- Previews can't be downloaded and the page has no audio element, so the founder listens in the panel or by the share link. Save the picked one by name, then record in Text to Speech.
- Facts stay as sourced. Only delivery gets casual.

## Edition files (from 5 Nov 2026)
- Each edition is `editions/<date>.json`: date line, take, transcription fixes, and per story a start word, kicker, source and lines, each line cued by a word the host says. `python beats.py <date>` builds the voice and cues and stops if a cue word is missing; `ui/film.html` draws whatever stories the file holds. A new day is a new JSON file, no code changes.
- Show voice: "forward slash host 1", from Voice Design (late twenties, light Indian English, creator talking to chat). Saving one voice closes the panel and drops the other previews, so play them all before saving.
- Stories must be dated the day covered. On 5 Nov three strong candidates were dated 3 Nov (Meta bonds, Apple Siri) and were left out. OpenAI's site blocks fetch tools; read it in the browser. We leave out Anthropic stories (Claude is made by Anthropic) unless disclosed.

## Founder on the 5 Nov edition: "This is not how I want it"
- Delivery like a radio jockey: "This is your AI Wrap today, and this is what happened." Host energy, not a reader.
- "Other than showing white slides, who's gonna watch all this? I'm talking about Instagram stuff." Type on paper is out for this show. Each story shows the real thing on screen (the actual source pages, product UI, real clips), cut fast, big captions, dark and colourful with the gradient as accent.

## AI Wrap reel build (5 Nov 2026)
- `capture/grab.mjs <url> <png>` captures the real source page at phone width (2x); `capture/find.mjs <url> <port> "phrase"...` returns where each key phrase sits, in the screenshot's pixels. Those boxes become the shots and highlighter marks in `editions/<date>-wrap.json`.
- `ui/wrap.html` (9:16): ON AIR pill, story number and kicker, the page in a card with a camera that eases to each cue word, a gradient highlighter sweep over the marked line, a pop line that punches in, captions in the safe zone, and a waveform drawn from the voice level per frame. Frame 0: title over today's three pages.
- Camera: centre on the marked line but clamp to the page edges; unmarked shots hold the left edge, or titles get cut off.
- Windows can hold a rendered PNG open; cleanup with `rm -rf ... || true`, and keep the check frames clear of the file's last 0.3 s.
- Transcription writes "Number 1", "5th", "chat GPT", "SWE2": the edition file's fix list and beats.py's joins turn them back for captions; cue on words as transcribed (start cue "Number").

## Founder on AI Wrap v1 (5 Nov 2026): fast start, show what they shared
- "The starting was too much time. It should start just like that." The voice now comes in at 0.3 s over the jingle (edition `lead`), with the jingle at half level under it. The "Here's what went down yesterday" line was cut from the take, so story one lands at 5 s (was 10 s). Cut a take at silence found from the voice level, not at transcription times.
- "Along with the text highlight, show some screens of what they have shared... some video or anyone talking about it." Each story now plays the company's own post next to the page: big over the page when the host names the launch, then small beside the highlight. 5 Nov: OpenAI's launch video and GIF clip, Cognition's SWE-2 Flash chart, Conductor founder Charlie Holtz's video.
- Finding them: the source article often links the founder's X post (TechCrunch did); otherwise read the company's X profile in the BCON Club Chrome and keep posts dated the day covered. `capture/media.mjs <url> <port>` lists a page's images, videos and X/YouTube links. `yt-dlp` downloads X videos; `cdn.syndication.twimg.com/tweet-result?id=<id>&token=4` gives the post text, date and image URLs.
- Video in a seek(t) page: extract frames at 24 fps to JPG, set the img for each t, and let `__seek` return the image's decode promise; the renderer awaits it (`awaitPromise`). Check the clip's end for black frames (`blackdetect`) and hold the last good frame.
- Edition fields: `posts` (name, handle, date, quoted text, frames dir or image) and per story `media` [{cue, post, mode big|pip, in}].

## Sound bites from the company's own video (6 Nov 2026)
- The founder sent OpenAI's YouTube launch video (youtu.be/9ZxCOHkfn_8, 4 Nov, Charlie Guo on camera). Use a company's own on-camera video as a 2-4 s sound bite right after the host names the launch.
- How: `yt-dlp` the video, transcribe with word times (faster_whisper on `device="cpu"`; the GPU path fails without cublas), cut the bite at a word end, level it to the host take's LUFS, and splice it into the host take at a silence between words (150 ms before, 200 ms after). beats.py then cues it like any other word, and the captions show the speaker's words.
- In the page: a `src: "yt"` post shows ▶ and "THEIR VIDEO"; its text carries the speaker's name and title exactly as the video's lower third shows it. Set the media `in` so that the source time equals the film time minus the splice point, and the lips stay in sync.
- Watch for: the story pop covers the bottom of the clip, which hides the video's own title.

## No "chat" (founder, 6 Nov 2026)
- The host never says "chat" ("Yo, what's up chat?" / "See you tomorrow, chat!"). Use "Yo, what's up, everyone?" and "See you tomorrow, everyone!", and the end card text must match.
- To change only those lines: generate them in the same ElevenLabs voice and settings with the line next to them for context, level to the take's LUFS, and splice at the silences between sentences.
- After a splice, transcription can glue a word onto the one before it ("2.6 faster"). The edition's `"time": {"Faster": 13.61}` sets the measured start back and begins a new caption line there.

## Slashers, teaser first, no yesterday/today (founder, 6 Nov 2026)
- The forward slash audience is called **slashers**: "Yo, what's up, slashers! This is AI Wrap on forward slash." Sign-off: "And that's your AI Wrap. Catch you next time, slashers!" The end card text must match.
- The host never says "yesterday", "today" or "tomorrow". The date shows on screen only (THURSDAY 5 NOV 2026), with no "YESTERDAY, 4 NOV" line.
- Tried and rejected (v5): a spoken headline teaser before the greeting. The founder said it doesn't work.

## News format: one entry, the stories, one close (founder, 6 Nov 2026)
- Like a news show, every AI Wrap has the same structure every day, so it is repeatable:
  1. **Entry sting**, 2.4 s, on the opening jingle's 0.3 s beat. Frame 0 is the AI WRAP title over the day's three pages. On beats 1-3 each page flicks to the front, then a gradient slash wipes across the screen and the title punches in (scale 1.22 to 1).
  2. The host comes in at 2.4 s: "Yo, what's up, slashers! This is AI Wrap on forward slash." Then the stories.
  3. **Close sting**: after "Catch you next time, slashers!", the same slash wipe leads into the AI WRAP + date + forward slash lockup while the closing jingle rings out.
- The code is in ui/wrap.html (`wipe`, `ENDL`); beats.py writes `cues.wipe` (last word + 0.1 s), and the edition sets `"lead": 2.4`. Only the pages change from day to day.

## 2026-11-10: AI Wrap goes numbered (founder)
- Name: "AI WRAP 01", "02"... numbered editions, no week or theme name. Content: the main things so far this month
  (Wrap 01 = 1-10 Nov, the AI money moves: OpenAI $11B at $1.25T, Meta $20-25B bonds, Google $17B Wyoming).
- Keep: fast pace and the cards. Not a crazy pop-art style video.
- Music was "really bad" and never changed since 2 Nov (same jingle_A/theme_A every edition, jingle + bed + jingle).
  Now: new ElevenLabs track per edition, 40 s, instrumental, starts on the first beat; founder picks from 4 options
  (2 prompts x 2 variants, 1,200 credits each); one track untouched, the film ends with it.
- ElevenLabs Music page: set the custom duration by clicking the field, ctrl+a, type 0:40, Tab (Enter does not stick).
  Download menu needs two clicks after another menu closes; choose MP3.

## 2026-11-10 (later): AI Wrap 01 v2, "keep them hooked the whole way" (founder)
Founder notes on v1: three stories is too thin, cover the whole market (who owns the pie), the bottom half was empty
("khali"), page text got cut off, hook must be stronger, use the effects we already have.
- Page: `today-in-ai/ui/wrap2.html` (render with `PAGE=ui/wrap2.html node anim/render_wrap.mjs ...`). Cues come from
  the host's words, so the picture follows the voice. Sections: $ hook -> open-loop question -> 5 numbered stories ->
  close -> end card.
- Retention kit (from mg-styles-15, MIT, and our code-films playbook): hero number on frame 0; open loop ("Who owns the
  AI pie?") paid off later; something new every 1.5-3 s (shot change, figure, chip, chart step); overshoot pops
  (scale 0 -> 1.15 -> 1); camera shake on each hit; slash wipe on every section change; 5-segment progress bar so
  viewers see what is left; hero moment at 60-70% (spend race + "2x" stamp); end card with the next edition.
- Fill the 9:16 frame: card 780 tall, a big counting figure under it, captions, full-width waveform. Never zoom a page
  past its line width; desktop pages (CNBC) get zoom 1.5 on the article column (`zoom`, `x0`).
- Bug fixed: the waveform's display was set to block, which collapsed it to one column. It must be flex.
- Music longer than the picked take: ElevenLabs Music > Generations > the track's "Edit Song" lets you prompt "extend to
  66 s, keep the Final Hit as the last 10 s" (900 credits/min x 2 variations). Same song, longer, ending intact. Download:
  Download > Full song > download icon > MP3.
- Long text into ElevenLabs TTS by typing can freeze the tab for ~30 s; it still lands. Wait and reload, don't retype.
- Facts: real IPO terms beat press valuation talk (Anthropic S-1/A, 10 Nov: $70-78). Leave out what can't be sourced
  (an "all AI is worth X" total; Nvidia's live market cap).

## 2026-11-10 (night): AI Wrap 001 v5, documentary bites (founder: "bring in Sam Altman... Dario... pump it up")
- Bites from the people themselves, found by caption search: `yt-dlp --skip-download --write-auto-subs --sub-langs en-orig`,
  grep the VTT for the theme words, then `--download-sections "*55:10-55:28"` to take only seconds. Prefer the original
  interview over clip channels (Sam: Sources Podcast VeizK1M7V7E, 1 Sep; Dario: WSJ Davos K7F6ohcBJus, 20 Jan).
- Splice each bite into the host take in a silence (150 ms before, 200 ms after), levelled to the host's LUFS. On screen: a
  full-width panel (1080x900, face-centred 1080 crop, slow push-in, wipe-in) plus a lower third (name, role, source+date).
- Detect camera cuts inside a bite (mean frame diff > 25 at 64x64). Never show the interviewer during the bite. After the cut,
  hold the speaker's last frame dimmed and blurred and punch the key words as a quote card on the word they are said.
- Edition numbers on screen only ("AI WRAP 001"); the host says "This is AI Wrap". Cut a spoken word out of a take on the
  silences around it (loudness envelope at 20 ms) instead of paying for a new take.
- Hook number counts up: frame 0 holds the finished figure (thumbnail), then from 0.4 s it counts from 0 to it as it is said.
- Colour: gradient only on the one hero figure per scene, "AI" and the slash. Bars, labels, captions and waveform are neutral
  ("we are overdoing the colour").
- ElevenLabs Edit Song: "extend to N s" may APPEND a new section after the Final Hit (the song stops ending on its hit).
  Say "make the Main Hook section X s long instead of Y, do not add any new section, end with the Final Hit". Check the
  end matches the previous cut (correlation of the last 10 s ~0.99).

## 2026-11-10 (late): AI Wrap 001 v9, "give them value, not floating numbers" (founder)
- Frame every company the same way so a viewer learns something: WORTH / RAISING / SPENDING (or LISTS, BORROWING,
  INVESTING). Host script says it plainly ("Here's what each player is worth, what it's raising, and what it's spending").
  On screen each company builds a 3-row numbers card under its footage, one row per spoken cue (label, figure in the
  brand colour, a short plain note). No lone figures.
- "Who owns the pie" means everyone: the public giants by market cap (companiesmarketcap, read on the day) plus the labs
  at their latest round/IPO. SpaceX now carries xAI. Ten slices, each with logo + value; slices land as names are said.
- The CEOs talking is the hook: cold open on the bites (Sam, then Dario), frame 0 = both faces + the question.
- Real footage under the host: download the story's news piece (CNBC Television, 720p), split shots with
  `select='gt(scene,0.3)'` and a contact sheet, pick product/logo/floor/aerial shots (never anchors), cut film-time
  windows (`broll_cut.py` -> ui/broll.js). The article page comes back for the key number so the source stays visible.
- Brand logos: Simple Icons (CC0) via jsdelivr; Microsoft/Mistral from Wikimedia Commons (public domain); licences in
  EDITR brand/logos/LICENSES.md. White marks (filter) on dark; each section's accent = the brand colour (caption word,
  figures, bars, slices, background tint). Gradient only on the hero figure and "AI".
- Crop bites face-centred and outside burned-in captions, sponsor logos and channel bugs (check corners of frame 40).
- Script changes shift the voice length: tighten long pauses (`tighten.py`, max 0.36 s) to fit the music instead of
  re-extending the song.
