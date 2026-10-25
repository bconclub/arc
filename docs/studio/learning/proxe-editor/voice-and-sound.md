# Voice and sound

- **Voice: Cass ("Cass - Warm & Energetic British Woman", ElevenLabs voice library, Eleven v4).** The founder picked it
  from five British female auditions (Charlotte, Natasha, Cass, British South London Female, Amara) on 2026-10-24.
  One voice for every UK industry ad, so the voice is not a test variable. "PROXe" is typed as "Proxy" so it is said
  right.
- **Audition by sending files.** The founder listens on the phone (Remote Control): download each take and send it;
  ElevenLabs History alone is not enough.
- **Change one line, keep the liked take.** When the founder changes a line, generate only that line in the same voice
  and splice it into the liked take at a natural pause (find pauses with ffmpeg `silencedetect`, cut mid-pause, add
  0.1-0.3s air). Every later beat shifts by the inserted length; retime the edit and any lip-sync slices.
- **No chime / ting on end cards.** Music only (see brand-reuse.md).
- **Music:** reuse the founder-approved V1 bed for PROXe; it runs low (~0.16) under the voice and lifts (~0.6) on the
  end card, and we play its last N seconds so its own ending lands on the end card. A new track still needs the
  founder to audition options first (shared house rule).
- **"The voice is broken"** (2026-10-25) came with bad Kling lip-sync: a voice over a mouth that doesn't match reads as
  broken even when the audio is clean. Fix the picture, not the voice.
