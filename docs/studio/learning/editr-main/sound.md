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
Rules for us (superseded 2026-11-10, see below: SFX now go in every video); music and voice stay ElevenLabs; never install a repo or model
without saying size and source first. Our current SFX are synthesised in `tools/mix.py` (ai-video skill, `ctx.sfx(t, name, gain)`),
18 dB under the voice by default; `sfx_gain: 7` in reel.json made entrance sounds audible in the Lokazen reel.

## Conversation films and current mix rule (added 2026-11-02)
- Mix rule now: one track, untouched, one low fixed gain, no ducking or fades (house rule 11). The ducked recipe above is old.
- Voice direction the founder liked: "firm, flat", then "give a soul". Casual was rejected ("the line should land sharply"), and "firm, assertive"
  over-acted. One voice plays both twins (MK8). Split one full take on pauses with `silencedetect`, check the piece count against the script.
- Sitcom music at gain .16, crickets only where the founder asked (The Interview, frame 14). Subtitle text must match what the voice says.

## Sound design in every video (founder rule, 2026-11-10)
Founder, after the reel instagram.com/reel/DfII6u2Nl_p (ultra.skills, "Fix Claude's sound effects"): this skill goes into
**every video by default**, in every editing session. Its method is right sound, right place, no clipping.
1. **Right sound: one small kit per project.** Whoosh, riser, hit, impact, pop/click, sweep and tail. Use real
   recorded sounds, CC0 from Openverse/Freesound. Log each sound's creator, licence and URL in `LICENSES.md` next to the
   kit. Never synth beeps, cartoon boings or dings, and never ElevenLabs (it is for music and voiceover only).
2. **Right place: every sound hangs off a cue the picture already uses.** Use the same cue sheet that drives the
   animation, so each sound is frame-accurate. Sounds go only on real visual events:
   - a transition or wipe gets a whoosh;
   - a number or word slamming in gets a hit;
   - a build into the hero moment gets a riser;
   - the hero moment gets an impact;
   - the end card gets a tail.
   Never put a sound on every caption. Allow at most about one sound every 1.5 s, and leave quiet bars.
3. **Right level: no clipping.** Effects sit 12-18 dB under the voice. The voice stays clear on phone speakers. The
   music stays one track, untouched, with no ducking. Master to -14 LUFS with true peak at -1.5, then listen once
   through end to end.
4. **The founder's words win.** If he names a sound or a moment, do that. If he says it is too much, cut back. This
   keeps the 2026-10-27 lesson: pings everywhere "made it really bad". Taste beats volume.
- Tools: Openverse API (`api.openverse.org/v1/audio/?q=whoosh&license=cc0`, answered on 2026-11-10). earshot
  (github.com/Leonxlnx/earshot, MIT) scores an edit and aims SFX, but it downloads 1.1 GB of models: get the founder's
  yes before installing. The ultra.skills guide (Earshot, RealSFX, Openverse) is gated behind a "comment SOUND" funnel.
  RealSFX could not be found publicly.

## Fixing a bad camera voice (open source, 2026-11-12)
Windchasers raw takes: the lav was recorded on the LEFT channel only (right at -71 dB), so every earlier cut played
the voice in one ear; plus electrical hum lines and a dull top end. Measure each channel before editing
(`numpy` RMS per channel, `showspectrumpic` for hum lines).
1. `pan=mono|c0=c0` (the mic channel) -> 48 kHz WAV.
2. DeepFilterNet 0.5.6 Windows build (official release exe, no Python needed; the pip package needs Rust on Python
   3.13): `deep-filter.exe -D -a 32 -o out *.wav`. `-D` keeps sync, `-a 32` caps the reduction so it stays natural.
   Noise floor -43 -> -73 dB, hum gone.
3. EQ: highpass 75, -3 dB at 330 Hz, +4 dB at 3.4 kHz, high shelf +3 dB at 8.5 kHz, `deesser=i=0.35`.
4. Cut the cleaned WAV with the same phrase times as the picture; `pan=stereo|c0=c0|c1=c0`.
Tool lives in `C:\dev\tools\voicefix` (also a GPU PyTorch venv there for heavier models if needed).
