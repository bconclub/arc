# Reference library (10 Nov 2026)

A numbered library of template previews from 18 AI video tools, each one looked at and rated, with our own prompt
to remake the look. It is on ARC at `/dashboard/studio/references` (behind the login) and locally at
`localhost:4460/fx/` (EDITR `content/proxe/fx`, served by the Episodes Hub).

## What is in it
- 7,312 references from Higgsfield, PixVerse, Hailuo, Pollo, CapCut, Creatify, Kling, GoEnhance, Pika, Vidu, Topview,
  Krea, Media.io, A2E, Invideo, Viggle and Luma.
- 7,254 were rated. 1,153 are kept (rated 4 or 5). The rest sit under Skipped, not deleted. 58 could not be opened.
- Every kept one has our prompt. Videos with sound also have music notes and a music prompt. 180 kept ones also show
  the site's own prompt, where the site publishes it.
- Every reference has a stable number: H0042 (Higgsfield), K0109 (Kling), X1393 (PixVerse) and so on. A brief can say
  "use K0109". `#K0109` in the address opens it.

## Founder rules behind it
- "Whatever mediocre you can skip. I want the field to be really, really high quality." So: rate first, write second.
- Pull the site's own prompt where it gives one. Where it gives none, write ours, and it must stay close to the clip.
- The prompt improves from his feedback on results: bump the version on that reference, keep the number.
- Anything he names always stays, whatever the rating (H0002 was rated 3 and is his pick).

## The rating bar
5: could pass as a top studio's brand film. 4: strong, small flaws only. 3: fine but generic. 2: gimmick, meme filter,
face swap, or visible AI faults. 1: broken. Only 4 and 5 get a prompt. What it kept, by source: Higgsfield photo and
video templates 407 of 1,051; PixVerse 190 of 2,207; Higgsfield effects 138 of 730; Hailuo 77 of 582; Pika 61 of 179;
CapCut 59 of 482; Krea 53 of 133; Pollo 46 of 542; Creatify 33 of 289; Topview 21 of 136; Kling 21 of 226; Viggle 0 of 72.

## How a clip is read without playing it
`fx/tools/ref_probe.py <ref>` reads the preview straight from its link with ffmpeg: ten evenly spaced frames as one
strip, the cut times, and audio measurements (tempo, bass per second, strong hits, a speech hint). Stills are fetched
as one image. Nothing is played aloud. The brief each writer follows is `fx/tools/PROMPT_BRIEF.md`.

## What we learned
- Most template libraries are filters and memes. Outside Higgsfield's marketing sets, 3 to 12 in every 100 pass.
- The good material clusters: Higgsfield Marketing Studio, PixVerse "Product Hype" and "Portrait Studio", Pollo
  "Camera Control" and "Visual Concepts", Hailuo's ad group, Topview featured cases, Pika style boards, Krea's
  featured mini apps, Luma.
- Site names and descriptions are often wrong for the clip. Write from the frames.
- Reviewers differ. One kept 67 in 100 where the others kept about 40; a stricter second look brought it into line.
  Check the pass rate of every batch and re-rate the outliers.
- Sites list the same template twice. Look for twins by name inside a source before calling the set finished.
- Music notes are measurements, not listening. Say so wherever they are shown.
- Ten frames are too few for films over 30 seconds. Re-read a long one with more frames before remaking it.
- Reference numbers that are not in a row (HX jumped from 510 to 621) break "from A to B" splits. Hand out explicit lists.

## Where the data lives
The previews and some prompts belong to the sites they came from, and this repo is public. So the data is not in the
repo: two JSON files in ARC's private `studio` storage bucket (`refs/kept.json`, `refs/skipped.json`), served to the
page through `/api/ops/studio/refs` as a short-lived signed link. To refresh them, rebuild `fx/arc_upload/*.json` in
EDITR and PUT each to the signed upload link that the same route returns on POST.

## First use
casso v02 (code film, no generation) was rebuilt from four kept references: K0109 (black void, light slides in),
L0008 (looks wiped across one held frame), K0017 (frozen moment, full orbit), H0123 (exploded view with callouts).
