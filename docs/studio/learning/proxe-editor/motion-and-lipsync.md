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

## First Seedance 2.5 test (2026-10-25)
One talking shot, 480p, 4s, still + Cass's line as `reference_audios.audio_1`, generate_audio on: **$0.59**, exactly the
formula price. Mouth shapes follow the line, the gesture lands on cue, the face holds. Seedance returns its own audio
track (32 kHz); compare it with the real VO laid over the picture before choosing.
**Founder note on the still used:** the round-6 clinic "looks really bad"; realism must not mean a shabby business.
Keep the business looking good (clean, well-kept, professional) and get realism from the camera, the person and
honest light instead.

## Lip-sync rule learned the hard way (2026-10-25)
Seedance does NOT follow the reference audio's timing: it re-speaks the line at its own pace (0.4s late, different
pauses). Laying our VO over its clip will never sync, and the founder hears it at once ("the voice is not matching").
Use the clip's OWN audio timing. Either keep Seedance's own voice (founder picked this: it also suits the face), or run
that audio through ElevenLabs Voice Changer to another voice (keeps the timing). For off-camera lines in the same
voice, clone it with ComfyUI `ByteDanceSeedAudio` (reference_mode "audio reference", up to 3 clips; $0.21/min;
sample_rate must be the string "44100"). Audition voices ON the face (same shot, different voices) before choosing.

## Same voice across several talking shots (2026-10-25)
With generate_audio on and no reference audio, Seedance invents a voice per clip. To keep one person's voice across
shots 1, 3 and 6, feed their approved voice-test audio as `reference_audios.audio_1` and write the new line in the
prompt: it speaks the new line in that voice (720p re-run of shot 1: same timing and a 0.99 spectrum match to the
approved 480p test). Jobs queued back to back run one at a time on Cloud (~3 min per 6s 720p clip).

## Queueing gotcha
Queueing a prompt over the raw API without the page's auth failed "Please login first" (not billed). Load the API prompt into
the canvas with `app.loadApiJson(prompt)` and run `app.queuePrompt(0)`: that path carries the sign-in. Never
`queuePrompt(-1, ...)` (silently dropped on Cloud). Results: `/api/jobs?limit=1` for status, `/api/history_v2/<id>` for
outputs (plain `/history` is not available on Cloud), `/view?filename=...&type=output` to download.
