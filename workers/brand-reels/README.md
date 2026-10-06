# Brand Reels worker

ARC > Content > **Brand Reels** is where the team drops Instagram links and where every finished cut lives (Library: Sent, Approved, Live). ARC only holds the links. This folder is the bridge an editor uses to pull a link, make it, and push it back.

## Pull mode (the normal way)

In any Claude Code session on a machine with this folder and the `brand-reel` skill installed, just say:

- "what's in the reel queue" → `node worker.mjs list`
- "pull a reel" → `node worker.mjs pull` (claims it, downloads it, writes `job.json`, prints `JOB_DIR`)
- Claude follows the skill in `JOB_DIR`, the ARC page shows its progress live
- `node worker.mjs push <JOB_DIR>` → files go to ARC Storage (and Drive when configured), the reel shows as **Sent**

Then in ARC: Approve, Request changes (queues the next version, pull it again the same way), or Mark live with the post link.

Install on Windows (done for `editr` on 6 Oct 2026): copy `skill/brand-reel` to `~/.claude/skills/brand-reel`, replace `__WORKER__` in its SKILL.md with this folder's `worker.mjs` path, and create `.env` from `.env.example`. On the Mac `./install.sh` does it (stop before step 5 if you don't want the daemon).

## Daemon mode (optional): an unattended Mac

The same queue, but the Mac claims every link as it arrives and runs headless Claude on it, under launchd, forever.

```
team pastes IG link in ARC ──> brand_reels row + agent_jobs(kind=brand_reel)
                                         │  POST /api/agent/next (every 30s while idle)
Mac: worker.mjs ── claims job ───────────┘
  1 download    yt-dlp / gallery-dl -> ref/, 1 fps frames, contact sheet  (sheet shown in ARC)
  2 create      claude -p, skill "brand-reel": breakdown -> plan -> stills (OpenAI) -> motion (Seedance)
                -> sound (ElevenLabs) -> ffmpeg edit -> BCON end card -> QC -> out/manifest.json
  3 upload      every manifest file -> ARC Storage (bucket brand-reels) + Drive Brands/<Brand>/Brand-Reels/<Slug>/vNN/
  4 review      ARC shows the cut: Download, Approve, or Request changes (queues vNN+1 with the notes)
```

Login is ARC's own owner login. Nothing new for the team.

## Setup on the Mac (once, about 15 minutes)

1. Pull ARC (or copy this folder) onto the Mac, then:
   ```bash
   cd ARC/workers/brand-reels && chmod +x install.sh && ./install.sh
   ```
   The first run creates `.env` and stops.
2. Fill `.env`: `ARC_INGEST_SECRET` (same one as the editor desk), `OPENAI_API_KEY`, `ARK_API_KEY` (Seedance, or drop the old `ark.key` into `tools/`), `ELEVENLABS_API_KEY`.
3. Make sure `claude` is logged in on this Mac (`claude` once in Terminal).
4. Drive (optional, recommended):
   ```bash
   node drive-auth.mjs <CLIENT_ID> <CLIENT_SECRET>
   ```
   Use ARC's Google OAuth client (Desktop type, Drive API enabled). Sign in as brands@bconclub.com. Without this, files still land in ARC; Drive is skipped.
5. Run `./install.sh` again. It checks everything (`doctor`), installs the skill to `~/.claude/skills/brand-reel`, and starts the service.

ARC's Brand Reels page then shows `mac-editor · idle` in the top right.

## Day to day

| What | Command |
|---|---|
| Live log | `tail -f ~/Library/Logs/brand-reels.log` |
| Health check | `node worker.mjs doctor` |
| Run one job by hand | `node worker.mjs once` |
| Stop / start | `launchctl bootout gui/$(id -u)/club.bcon.brand-reels` / `./install.sh` |
| Update skill or worker | `git pull && ./install.sh` |
| A job's files | `~/BrandReels/<code>-<id>/vNN/` (`claude.log`, `out/NOTES.md`, `out/PLAN.md`) |

Jobs run one at a time. A failed job retries once after 5 minutes, then shows Failed in ARC with the reason and a "Run again" button. Cancelling in ARC stops the running job within 30 seconds.

## Files

| File | Does |
|---|---|
| `worker.mjs` | the loop, download, Claude run, upload, ARC reporting |
| `drive.mjs`, `drive-auth.mjs` | Drive upload as brands@bconclub.com |
| `skill/brand-reel/` | the creative method, brand profiles, the 14-reel reference library, craft lessons |
| `tools/image.py`, `tools/seedance.py`, `tools/audio.py` | generation clients (OpenAI images, BytePlus Seedance, ElevenLabs) |
| `endcard/` | BCON end card template, renderer, default card, splice |
| `install.sh` | deps, skill install, launchd service |

## ARC side

- Table `brand_reels` + `brand_reel_events`, private bucket `brand-reels` (migration `20261006120000_brand_reels.sql`).
- Dashboard API (cookie): `GET/POST /api/ops/brand-reels`, `GET/PATCH /api/ops/brand-reels/[id]`.
- Worker API (bearer `ARC_INGEST_SECRET`): `/api/agent/next`, `/api/agent/result`, `/api/agent/heartbeat`, `/api/agent/brand-reels`.
