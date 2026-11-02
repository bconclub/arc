# Today in AI: the daily show (forward slash, started 2026-11-02)

Founder: a series that goes out every day, each edition covering the day before. "We need a proper start, a proper end, a jingle, one proper voice, the way they talk, end to end."
Before it: Who Is Paying (dropped, framing), The AI Bill ("I don't think this is working").

## Format
Open card with jingle and date, three stories, close card with jingle. Anchor: Rehan Waris on Eleven v4, tag "[clear, warm, confident news anchor]". Light paper, Inter, the forward slash gradient on the slash and one accent per story. Type on paper, no stock footage: no rights to clear, and it can ship daily.

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
