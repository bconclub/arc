# 06 · Tools and how to drive them (Windows PC, `C:\dev\builds`)

## Pulling a reference
- `python -m yt_dlp --write-info-json --merge-output-format mp4 --ffmpeg-location <imageio-ffmpeg exe> -o ref.%(ext)s <url>`
  (ffmpeg isn't on PATH; use the imageio-ffmpeg binary in Python's site-packages).
- Instagram rate-limits logged-out pulls: one at a time with ~20-25s gaps; if `/reel/` fails, retry `/p/`. Some
  posts need the logged-in browser.
- A whole profile: open it in the logged-in BCON Chrome, scroll and collect every `/p/` and `/reel/` link (the grid
  is virtualised, collect while scrolling), draw the grid thumbnails onto one canvas as a numbered contact sheet,
  then pull the reels with yt-dlp. Instagram's own API (`/api/v1/...`) returns 429 quickly: don't rely on it.
- Contact sheet: `ffmpeg -i ref.mp4 -vf "fps=24/<dur>,scale=160:-1,tile=12x2" -frames:v 1 sheet.jpg`.
- Cuts: `ffmpeg -i ref.mp4 -vf "select='gt(scene,0.3)',showinfo" -f null -` (read `pts_time`).
- Never view a client's Stories (it shows who watched). Read only: no follows, likes, comments or DMs.

## Analysing
- Audio: EDITR `social/tools/audio_analyze.py <file>` → BPM, loudness per second, biggest rises, brightness,
  onsets, cuts, cuts on the beat; writes `<file>.audio.json`.
- Shots: BVCL `clients/calvary-caters/moodboard/_work/shots.py <reel dirs>` → `shots.json` + a labelled `shots.jpg`
  per reel (scene cuts + long takes split into ~3s pieces, labels `reel.shot start (len)`).

## Claude in Chrome
- Always the BCON Club browser: deviceId `f28429cc-f693-4ada-abe8-6d15eb10f7d7`. Call `select_browser` before
  browser work; the selection can flip to another connection.
- Downloads land in `~/Downloads`, sometimes as `.tmp` or blocked after several in a row ("allow multiple
  downloads"). Trigger each download in its own step, match by name or byte size. If blocked, ask the founder to
  allow downloads for the site; a zoomed screenshot is only a preview.

## ChatGPT (images)
- Type with real keystrokes, then Return. Line breaks in a typed prompt send it early: keep prompts one paragraph.
- **Clear the composer first** (`ctrl+a`, Delete): ChatGPT keeps unsent drafts per project/new chat, and a leftover
  draft merges into your prompt (a Calvary end card merged into a Tesla prompt this way).
- Attach references with the "Attach photos" file input (`file_upload`), not by clicking the picker.
- Detect new images by `src`, not count; download via `fetch(img.src)` → blob → `<a download>`.
- Use a separate chat per job (Brands project for brand work) so agents don't collide; tell the other agents
  which chat is yours. Don't touch a chat the founder is typing in.

## ElevenLabs
- Voice: Text to Speech, voice "Jeevan - Expressive and Confident" (Eleven v4) worked for an Indian male VO.
  Replace the text with `ctrl+a`, then type; download from each generation's icon.
- Music: type into "Describe your song" (not the lyrics box); set a custom duration (click, `ctrl+a`, type 0:20,
  Enter); download via the ⋮ menu → MP3.
- Decline trial and upgrade pop-ups.

## ComfyUI Cloud: see 04-motion-and-cost.md. Drive: upload through Chrome (the connector takes inline content only);
over 10 MB, split and rebuild (EDITR LEARNINGS.md "Tools").

## Agents
- Insta Daemon: studies the founder's references, keeps REFERENCE-REELS.md and AUDIO-LIBRARY.md.
- Social EDITR: builds organic reels. EDITR Main: client ads and films. Linkedin EDITR: PROXe. ARC Studio: client
  boards and storyboards.
- Message a session with SendMessage to its `local_...` id. Say who owns a job before starting it, to avoid two
  agents making the same stills.
