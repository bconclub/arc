# Tools: how we drive them and what bites

All browser work happens in the BCON Chrome via Claude in Chrome. The founder signs in; we never type credentials,
buy or upgrade.
- **Each machine has its own browser ID.** On the Windows PC at `C:\Builds\EDITR` it is **"BCON EDITR"**
  (deviceId `371f3d63...`, 2026-11-11); `f28429cc...` is the older BCON Club browser on another machine, and its
  downloads land on that machine, not this one. Don't pick from `list_connected_browsers` names ("Browser 1-4" mean
  nothing): call `switch_browser`, the founder clicks Connect in the right Chrome and names it.
- **Full-res images without downloads:** overlay the ChatGPT image at natural size in two side-by-side tiles, `zoom`
  each tile with `save_to_disk` (returns native pixels, ~941x836), then stack them with ffmpeg `vstack`
  (EDITR `content/claymation-test/stitch.py`).

## ChatGPT (images)
- Type the prompt as **one line**: a newline in `computer type` presses Enter and sends only the first paragraph.
  If that happens, let it finish (or stop it), then send the full prompt with "ignore that image".
- Send with Return or the send arrow; if the text stays in the box, click the arrow.
- Downloading: `fetch(img.src)` → `<a download>` from page JS **did not land** (2026-10-24). What works: the image's
  share icon → share dialog → **Download**. If the image is part of a pair, the icon first asks "This image / All".
- Downloads arrive in `C:\Users\<you>\Downloads` as `<uuid>.tmp` and **get cleared within seconds/minutes**: copy
  immediately, picking by `find Downloads -mmin -1 -size +1000k` (never just "newest .tmp": an old stray .tmp can be newest).
- Images come out 941x1672 (9:16). Pad/scale to 1080x1920 JPEG before uploading to ComfyUI.

## ComfyUI Cloud (video)
- Page JS: `const app = comfyAPI.app.app; const api = comfyAPI.api.api`.
- Open a fresh tab for your graph: `await app.extensionManager.command.execute('Comfy.NewBlankWorkflow')`. Never clear
  a workflow someone else has open.
- Uploads: inject `<input type=file multiple>`, `find` it, `file_upload` the files, then for each:
  `api.fetchApi('/upload/image', {method:'POST', body: FormData(image, overwrite)})` → use the returned hashed `name` in
  LoadImage.
- Build nodes with `LiteGraph.createNode(type)`, `app.graph.add(n)`, set widgets (call `w.callback(v)` for dynamic
  combos like `model`), `a.connect(slot, b, inputIndex)`. Queue with **`app.queuePrompt(0,1)`** (partner nodes need the UI
  token; `api.queuePrompt` gives Unauthorized).
- Check it landed: `/queue` (`queue_running`), then `/jobs?limit=1&sort_order=desc` and `/jobs/<id>` for outputs.
  Download: `api.fetchApi('/view?filename=<hash>&type=output')` → blob → `<a download>` (this one does land).
- A JS call that waits more than ~45s times out the tool; poll in ≤40s chunks (helper `zsWait(38000)`).
- Money: `/billing/balance` → `effective_balance_cents/100`. "Subscription or credits required to queue workflows" /
  "Update payment to run" with credit showing = payment method failed: stop, founder fixes it.
- Tool output blocks long base64-looking strings (node type lists show "[BLOCKED]"); print only what you need.

## ElevenLabs (VO + music only)
- TTS: click inside the text block before select-all (otherwise ctrl+a selects the whole page). Voice picker top right.
- The per-generation **Download** buttons work when clicked by ref (`find` "download buttons for Generation 1 and 2");
  coordinate clicks and the player-bar download did nothing. The audio element's blob can't be fetched from page JS.
- Music: Generations list → download icon → choose MP3. Two variants per run.
- A "credits remaining" upgrade pop-up appears at ~10%: close it.

## Drive
- The connector reads/searches/copies; big uploads go through Chrome: capture Drive's file input by patching
  `HTMLInputElement.prototype.click`, inject your own input, `file_upload` (≤ 10 MB per call), hand the files over with
  a DataTransfer and dispatch `change`. Over 10 MB: `split -b 9000000`, upload chunks, rebuild `new File([...])` in the
  page, check SHA-256, then hand over.

## ARC Studio (sharing understanding with every agent)
- No ingest secret on the Windows PC, so use the ops API from the logged-in arc.bconclub.com tab:
  `POST /api/ops/studio {name, mood, palette, brief, site_url}` → slug; `PATCH /api/ops/studio/<slug>` (logo_path etc.);
  `POST /api/ops/studio/<slug>/items {upload: name}` → `signedUrl`, `PUT` the file, then `POST {kind: note|image|video,
  title, body, image_path, prompt, source, tags}`.
- Feed files in with one injected file input; build the payload (brief, notes, prompts) in a Python script first
  (`zensquare_moodboard/arc/make_payload.py`). Never put credentials in notes.

## Instagram references
- `/embed/` page exposes the video src; fetch it on the CDN page to download. Video won't load in a background Chrome
  tab; use the app's browser pane.

## Studio (live edit view, localhost:4401)
- `studio/studio.mjs` in the EDITR repo, driven by `studio/_explore/now.json` (re-read every 2 s, gitignored). `.claude/launch.json` has
  the `studio` entry. `studio/now.py` updates fields, `studio/log.py` adds a timed activity line. See house rule 10.

## Browser and ElevenLabs quirks (2026-11-02)
- The extension's selected browser can flip between calls ("not in Claude's tab group"), and display names change. Call
  `select_browser` with the BCON deviceId in the same message as each browser batch. The deviceId is what counts.
- ElevenLabs TTS: page layout shifts cost two broken takes (about 780 credits). Screenshot and check the speaker chip and the text before Generate.
- Read the balance before planning sound: bottom of the TTS page, or `/app/subscription` for the renewal date. Music is 30 credits a second.
- Openverse often times out; Wikimedia Commons worked for SFX. Check the licence and listen for a usable file.
