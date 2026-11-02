# Sound: voiceover, music, mix

## Voiceover (ElevenLabs Text to Speech)
- The voice carries the story; captions repeat it for sound-off. Script from the brand's own words, no invented claims.
- ~2.4 words per second: 60-65 words fill 26s and leave room for a 0.8s thumbnail hold and an end card.
- Write numbers and symbols as they should be said: "Grade nine", "A star", "one to one", "Proxy" for PROXe.
- Voices used: **Zina - Confident & Clear** (Indian English, ZenSquare parent-facing ad), Samitha (Malayalam narrator)
  and Vijayesh (son) for SecondSpring, Jeevan (Hinglish). Offer other voices when the founder asks; they pick.
- Generate gives two takes; download both straight away (files in Downloads get cleared, see [tools.md](tools.md)).
- **Cut the pictures to the voice.** Find the sentence pauses:
  `ffmpeg -i vo.mp3 -af silencedetect=n=-35dB:d=0.25 -f null -` → each `silence_end` is where a line starts.
  Put every cut just before a line starts, so each shot carries its own line.

## Music (ElevenLabs Music)
- One brief, two options, 30s (set the duration; outputs can run longer). Brief shape that worked: genre + instruments
  + BPM + the arc ("starts intimate... lifts in the second half... resolves cleanly on the last bar") + mood words +
  "no vocals" + where drums come in.
- The founder picks by ear. Ship both cuts if they haven't picked yet.
- Trending Instagram sounds are added in the app at posting, never ripped into our files.

## Mix (ffmpeg, as used for ZenSquare)
```
[2:a]adelay=800|800,volume=1.15,apad[vo];[vo]asplit=2[vo1][vo2];
[1:a]volume=0.55,afade=t=out:st=28.3:d=1.7[mu];
[mu][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];
[duck][vo2]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]
```
- Music ducks under the voice and comes back up for the end card. Master to **-14 LUFS**, true peak -1.5.
- Check: `ffmpeg -i out.mp4 -af ebur128 -vn -f null -` (the summary `I:` line). Before loudnorm our mix sat at -26 dB
  mean in VO sections: too quiet for Reels.

## Real sound effects for edits (added 2026-10-30)
Source: Instagram reel instagram.com/reel/De9yxpuIG6X (life.with.akshat_, "Claude can't hear, so it fakes the sound").
Three free tools it names. What we checked ourselves:
- **earshot** (github.com/Leonxlnx/earshot, MIT): CLI / Python / MCP server, CPU only, needs Python 3.10+ and ffmpeg. Scores an edit against
  7 reference launch films with a timestamped scorecard, and its `sfx` command aims a whoosh / hit / click / note at a moment
  (bank of 201 sounds made in code). Downloads about 1.1 GB of open models on first use. Star counts quoted online disagree, so
  check the repo. Not installed yet: needs the founder's yes for the 1.1 GB, and read the source before running it.
- **Openverse** (openverse.org, free API, no key): 5M+ openly licensed images and audio, `GET api.openverse.org/v1/audio/?q=whoosh&license_type=commercial`.
  Pick CC0 / public domain so we never owe attribution, and write each sound's creator + licence + URL into a LICENSES file next to the
  audio. On 2026-10-30 the API did not answer from the PC shell or from the browser (timeouts), so not used yet; retry later.
- **"Real SFX" skill**: the reel says it ships 78 UI sounds. We found no repo by that name, so treat it as unverified.
Rules for us: SFX only where the founder asks (see founder-feedback.md); music and voice stay ElevenLabs; never install a repo or model
without saying size and source first. Our current SFX are synthesised in `tools/mix.py` (ai-video skill, `ctx.sfx(t, name, gain)`),
18 dB under the voice by default; `sfx_gain: 7` in reel.json made entrance sounds audible in the Lokazen reel.

## Conversation films and current mix rule (added 2026-11-02)
- Mix rule now: one track, untouched, one low fixed gain, no ducking or fades (house rule 11). The ducked recipe above is old.
- Voice direction the founder liked: "firm, flat", then "give a soul". Casual was rejected ("the line should land sharply"), and "firm, assertive"
  over-acted. One voice plays both twins (MK8). Split one full take on pauses with `silencedetect`, check the piece count against the script.
- Sitcom music at gain .16, crickets only where the founder asked (The Interview, frame 14). Subtitle text must match what the voice says.
