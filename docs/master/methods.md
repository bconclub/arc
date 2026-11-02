# Working methods

Things that took effort to find out. EDITR's own tool notes are in `docs/studio/learning/06-tools.md`.

## Large file upload to Google Drive
The Drive connector can only create small files. Large files go through Chrome, in the BCON Club browser profile (the
display name changes, so select it by device, id in `private/ids-and-locations.md`).

1. Split the file: `split -b 9000000 file part_`. Chunks must sit under the working directory, not the temp scratchpad.
2. On Drive, inject an `input type=file` and `file_upload` each chunk into it.
3. Patch `HTMLInputElement.prototype.click` to capture Drive's own file input.
4. Open New, then File upload. Wait about 1 s between clicks, because the menu misfires.
5. Rebuild with `new File(chunks, name)`. Check SHA-256 in page JS. The tool blocks returned hashes, so compare against
   the known hash and return a boolean.
6. Set the file on Drive's input with a `DataTransfer` and dispatch `change`.

## Google Drive connector
- `copy_file` copies between folders. `update_file` with `parentId` moves a file.
- Public files download from `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`. A private
  file returns HTML, so check what came back.
- Search with the full folder id. A truncated one gives "Entity not found".
- `create_file` can hit a quota error right after trashing files. A retry works.
- When you trash and recreate a doc, every link you already gave out dies. Tell Z.
- Client Drive folders can hold lead spreadsheets next to creative files. Never share a client folder whole.

## Gmail drafts with attachments
- The connector can't attach. Open the draft in Chrome and attach through the compose file input.
- `update_draft` **removes attachments**, so do text edits first and attach last.
- Verify by reading the draft as RAW and hashing the attachment against the local file.
- Signature links get mangled in plain text. Use `htmlBody`.

## Invoices
- Rendered from HTML to PDF with headless browser. Template and logo are local, see `private/ids-and-locations.md`.
- In PowerShell, `$` in a rupee amount or `$rup2` gets expanded and garbles the PDF. Use a single-quoted here-string or
  write the file with the Write tool.
- After sending, update `EDITR/brand/bcon-letterhead/invoices-sent.md`.
- ARC's `billing_documents` stops at July 2026, so don't treat it as complete. `gst_invoices` is the other table.

## Client proposal PDFs
Built as HTML pages at 816 x 1056 px (US Letter) and exported with headless Chrome (`--print-to-pdf --no-pdf-header-footer
--virtual-time-budget=8000`), then rendered to images to check every page. Past examples are in Downloads, source for one is
in `BVCL/clients/calvary-caters/proposal`.

House structure: cover, the goal, positioning, the flow from enquiry to customer with an example chat, numbers, next steps,
two signature lines. Mixed dark and light pages, a "BCON x client" header with a page pill, Anybody caps with an Instrument
Serif italic accent, in the client's colours. One idea per page. Don't add photos unless Z asks for them.

Anything a client may read on a phone: build tall pages at 480 x 853 px, body text at least 16.5 px, no wide tables (stack them
as rows). A US Letter page shrinks to unreadable text on a phone. Render each page at 390 px wide to check it.

## The video library
`C:\dev\builds\video-library\` is a local gallery of every video across the machine, on port 4177 (`video-library` in the
ISIVIS `launch.json`). It only opens on this computer. `build.py` probes files, sets the brand by regex, groups versions and cuts
thumbnails into `library.json`. Search, brand filter, latest and final toggles.

The server needs `protocol_version = "HTTP/1.1"`, Range support and a listener on both `::1` and `127.0.0.1`. Without those,
every thumbnail lost about 215 ms to the IPv6 fallback and the page crawled. The library's "final" toggle goes by filename,
so it doesn't meet the final-video rule.

## The montage
`C:\dev\builds\social\bcon-wrap-2026\` builds a 2026 wrap modelled on the "Previously on BCON" reel. `build.py` cuts shots to
beats from `beats.py`.

- Read the music's real drop time. A wrong sample rate put the drop in the wrong place.
- ffmpeg `tile` outputs nothing until the frame count fits the grid. Per-shot contact sheets are simpler.
- Reels often end on a call-to-action card. Take shots from earlier timestamps.
- Watch for letterboxed sources being cropped.
- Use confirmed-final work only.

## Windows and shell
- Long paths need the `\\?\` prefix. Printing emoji needs `PYTHONIOENCODING=utf-8`.
- Apostrophes break Bash heredocs passed inline. Use the Write or Edit tool.
- Standalone `Start-Sleep` is blocked.
- `-vsync` isn't recognised by this ffmpeg. Use trim and hstack.
- Headless Edge has a minimum window width, so phone-size screenshots clip. Use the browser pane's viewport tool.
- `preview_start` reads the `launch.json` of the current session's folder (`C:\dev\builds\ISIVIS\.claude\launch.json`).

## Before saying a thing is done
- Screenshots of a moment don't prove a transition. The `/flight` eye-zoom click was never caught on camera, and I said so.
- Sound can't be verified by a tool.
- An HTTP 200 doesn't mean a site works, or that it's yours. Only say a page was read if it was opened.
