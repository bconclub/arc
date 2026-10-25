# Tool quirks hit in this thread

## Claude in Chrome (BCON Club browser only)
- **Go by deviceId f28429cc..., never the display name** (names reshuffle: "Browser 1/2", "BCON Club"). A new
  browser connected mid-task on 2026-10-25 and became "in use" by itself; the founder caught it. Check `inUse` before
  every batch of browser steps and `select_browser` back if needed. BCON Club = all company tools (ChatGPT, ComfyUI,
  ElevenLabs, Drive, ARC Studio); the built-in browser = local dev previews only.
- The BCON Club extension disconnects now and then; then only other browsers are listed. Stop browser work and ask
  the founder to reconnect it. Never switch to another browser.
- **Typing into a background tab hangs** ("Input.dispatchKeyEvent timed out") when another tab (e.g. ComfyUI) is in
  front. Use JavaScript instead: focus the editor, select the text node's block with a Range, then
  `document.execCommand('insertText', false, text)`, and click buttons with `.click()`.
- ElevenLabs editor: the outer `[contenteditable]` holds the voice chip too; select the inner text block only, or the
  old script stays and you pay for a regenerate of the wrong text.

## Getting files out
- ChatGPT images: in the page, `fetch(img.src)` the last large portrait `<img>`, wrap it in an `<a download>` and
  click it; it lands in Downloads. Save each one before the chat grows (old images unload from the page).
- ChatGPT sometimes returns two versions side by side; save both and pick on hands and face.
- Chrome "Ask where to save each file" blocks every download behind a native dialog that we cannot click (computer
  use only gets read access to Chrome). The founder turned it off; if a `.tmp` appears in Downloads, the dialog is up.
- Sending the page's audio to a local server from the browser hangs (local-network permission prompt). Use downloads.

## Rendering
- Remotion: `npx remotion render <entry> <Comp> out.mp4 --port=<unique> --concurrency=4 --crf=20`, then ffmpeg
  `-c copy -movflags +faststart`. Use `remotion still --frame=N --scale=0.5` to check single frames fast.
- ffmpeg on this PC: `imageio_ffmpeg` binary under Python 3.13 site-packages.
- Headless Chrome screenshots (`--headless=new --screenshot`) render HTML mock-ups to PNG; give each run its own
  `--user-data-dir`.
- Always check frame 0 (hero + title) and a contact strip (`fps=0.5,tile=...`) before sending.

## Working with the founder remotely
- The founder is often on Remote Control (phone): send every result as a file, keep messages short, and finish each
  turn with one clear choice.
- Voice-to-text garbles words ("C Dance" = Seedance, "ting" = chime). Read for intent; ask if a line can't be decoded.

## Uploading >10 MB videos to Drive from the browser (2026-10-25)
The Drive connector can't carry big binaries and Claude-in-Chrome `file_upload` caps one call at 10 MB, and only
reads files inside the working folders (not the scratchpad). What worked: `split -b 7000000` the mp4 into parts in
the repo, `file_upload` each part (one per call) into a hidden `<input type=file>` on the Drive folder page, rejoin in
JS (`new File(parts, name)`), then patch `HTMLInputElement.prototype.click` so Drive's own New › File upload input
gets those files and a `change` event. A synthetic drop event did NOT work. Check sizes after with the connector.
