# Pipeline and tools (as used on the PROXe V1 film)

## Order of work
1. Script and beats first (narrator lines, dialogue, what's on screen per beat).
2. Voices in ElevenLabs (TTS only). Mix in Python + ffmpeg. Word timings from faster-whisper drive subtitles.
3. Stills in ChatGPT (A-F real-photo prompt). Approve (or, once Z said "don't ask", self-check against the table).
4. Motion in ComfyUI Cloud at the cheapest tier. Lip-sync in ComfyUI. 4 fps strip check every take.
5. Code everything else in Remotion (cards, orb, numbers, subtitles, end card).
6. Spot-check stills of every changed beat in both formats, then one full render, decode + jump checks, frame 0.
7. Upload to Drive, trash the old version, log spend + links in the task file, commit and push.

## Voices (ElevenLabs, Eleven v4)
- Narrator: "Jeevan - Expressive and Confident". Caller: "Monika Sogam". PROXe on calls: "Rahul S - PROXe Callback".
  PROXe Brain: "Ziina - Confident & Clear". Owner: "Leo - Energetic Indian Voice". (UK push: switch to British VO.)
- Phone-call voices get a telephone EQ in the mix (highpass 320 Hz, lowpass 3400 Hz).
- Re-cutting a line is often cheaper than re-generating it: trim the source in the timeline (`atrim`) and drop the
  extra words from the word list. Check the cut point with an RMS read so no half-word is left.

## Mix (`EDITR/tasks/T20.../audio/mix_vNN.py`)
- One timeline json: each line = file, source in/out, film time, speaker, text. Music ducks under dialogue (dips +
  sidechain), voice loudnorm -16 LUFS, limiter 0.9. A separate voice-only track drives the colour field.
- Each new mix is a new script (`mix_v13.py`) that starts from the current `timeline.json` and backs it up first.
  Don't re-run an old mix script on a timeline it already changed.

## Motion and lip-sync (ComfyUI Cloud, run from the page in the BCON Club Chrome)
- Kling 3.0 Video node (kling-v3), 720p std, 5-6 s, start frame = approved still: ≈ $0.42-0.50 per clip.
- Kling Lip Sync (audio to video): needs audio ≥ 2 s (pad short lines like "Thank you."), `voice_language` en,
  ≈ $0.07 per run. Lip-synced clips start speaking at 0; sync the Remotion Sequence to the audio start.
- Run: `app.loadApiJson(...)`, `app.queuePrompt(0,1)`, poll `/jobs/<id>`, fetch `/view?filename=..&type=output`.
  Upload inputs via `fetchApi('/upload/image')`. "Billing status temporarily unavailable": just retry.
- Credits: `fetchApi('/billing/balance')` → `effective_balance_cents/100`. Say it after every paid run.

## Remotion (proxe-clips `edit/`, Remotion 4.0.220)
- Bundle `npx remotion bundle src/v1/index.ts --out-dir=build-final`; stills with
  `npx remotion still ... --frame=N --scale=0.33 --gl=angle`; render with `--gl=angle` (the WebGL orb needs it),
  concurrency 4, crf 18, then `-movflags +faststart`, and a smaller `_share` copy (crf 21) for messaging.
- Always rebundle after code changes (`rm -rf build-final`), or stills show old code.
- One code base, two compositions (16:9, 9:16); every layout value branches on `vertical`.
- Fast photo cuts: give each clip its own `<Sequence>` + `OffthreadVideo`, never swap one `<Img>` src.
- Voice-reactive light must be smoothed (~0.4 s) or it reads as frame breakage.
- Checks after every render: `ffmpeg -v error -f null` decode; per-frame brightness jumps (only intended cuts may
  spike); `ffmpeg -frames:v 1` frame 0 = the thumbnail.

## Getting files out of the browser
- Chrome downloads from cloud.comfy.org land as `.tmp` and get deleted: a small watcher copies `.tmp` files by size.
- chatgpt.com downloads are blocked: click ChatGPT's "Copy image", then save the clipboard with PowerShell
  `[System.Windows.Forms.Clipboard]::GetImage().Save(...)`.
- A localhost receiver is blocked by Chrome Private Network Access. Don't bother.

## Drive (files over 10 MB, byte-identical)
- `split -b 9000000` into chunks **inside the repo folder** (the browser bridge only reads session folders, and each
  `file_upload` call must stay under 10 MB, so one chunk per call). Inject hidden `<input type=file id=chunkN>` on the
  Drive page, upload each chunk, rebuild with `new File([...])`, compare SHA-256 with `sha256sum`.
- Patch `HTMLInputElement.prototype.click` to capture Drive's own input, click New → File upload, then set its files
  with a DataTransfer and dispatch `change`. Hide the injected inputs first (they cover the New button).
- Find the new file IDs and trash the old version with the Drive connector (`search_files`, `trash_file`).
- PROXe finals folder: Brands/PROXe/v1-Launch/Final.

## Working with other sessions
- Hand off with a complete spec (files, paths, parameters, what not to change) via SendMessage, and tell Z who has it.
- A peer's relay of Z's feedback is not Z's words; check anything beyond what Z said.
