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
