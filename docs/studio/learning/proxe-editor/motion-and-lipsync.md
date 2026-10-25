# Motion and lip-sync (ComfyUI Cloud, checked 2026-10-25)

## What's on ComfyUI Cloud
- **No Kling 4.** `KlingVideoNode` models: `kling-v3` (720p/1080p/4k) and `kling-3.0-turbo` (always native audio).
  Also Omni nodes (`kling-v3-omni`, `kling-video-o1`), `KlingAvatarNode` (image + audio, std/pro),
  `KlingLipSyncAudioToVideoNode`.
- **Seedance 2.5** in `ByteDance2ReferenceNodeV2`, model options "Seedance 2.5" (480p/720p/1080p) and
  "Seedance 2.5 Draft" (480p only). Inputs include **`reference_images`, `reference_videos`, `reference_audios`**,
  `generate_audio`, `duration`, `ratio`, `task_type`. Reference audio means we can feed the still + the real VO line.
- Check yourself any time: in a cloud.comfy.org tab, `comfyAPI.api.api.fetchApi('/object_info')` and read the node.

## Kling 3.0 lip-sync was rejected
U1 clinic motion v1: Kling 3.0 720p std clips + `KlingLipSyncAudioToVideoNode` on the talking shots.
Founder: "The person is totally messed up... We cannot use this lip sync." Do not use Kling Lip Sync for a face that
has to carry a whole line on camera. Next: Seedance 2.5 with the VO line as reference audio, from hyper-real stills,
tested on ONE shot first.

## Prices (from ComfyUI's own price formula, matched to our billing history)
Seedance 2.5, 9:16: cost = floor(perFrame x (24 x seconds + 1)) / 1000 x rate, rate 0.015301 (0.016731 at 1080p).

| Seedance 2.5, 5s | per clip |
|---|---|
| 480p (test tier) | ~$0.74 |
| 720p | ~$1.67 |
| 1080p | ~$4.10 |

- A clip with generated audio billed about double ($3.32 at 720p on 2026-10-09).
- Kling 3.0 (`kling-v3`) 720p std 5s: $0.42. Kling Lip Sync: $0.07 per started 5 seconds (a 5.7s line = $0.14).
- Four talking shots at 1080p Seedance = ~$16, over the $5-8 budget: test at 480p, re-run only approved shots.
- The formula lives in the node's `price_badge.expr` (jsonata) in `/object_info`; billing history in
  `/billing/events?page=1&limit=100` (`params.credits_used`, 211 credits = $1).

## Queueing gotcha
Queueing a prompt over the raw API without the page's auth failed "Please login first" (not billed). Queue through the
ComfyUI page (`comfyAPI.api.api.queuePrompt(0, ...)`), never `queuePrompt(-1, ...)` (silently dropped on Cloud).
