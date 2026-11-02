# Founder rules, as the master session learned them

Z is the founder. Z dictates by voice, so names come through wrong. Work out what was meant from context and say which
reading you took.

## Voice-to-text names seen so far
| Heard | Means |
|---|---|
| "ETVS", "Series" | ISIVIS |
| "Beacon" | BCON |
| "Proxy" | PROXe |
| "Reshma", "Samrit" | Amrit Slesha |
| "ScanPicker" | Scan2Kare |
| "Washo" | Wash O Wash |
| "Calgary", "calorie" | Calvary (client; "calorie" was also said about the Calvary edit) |
| "Master" at the start of a line | Z addressing this session |
| "Thalid" | Assumed Khaleej, never confirmed |

Still unidentified: "Ambujito".

## Standing rules
- **Don't delete anything.** Moving, copying and tidying are fine. Files that aren't confirmed go to a holding folder.
- **Don't send client email or push to production without Z's go-ahead for that specific thing.** A draft is fine.
- **Build the real thing.** Sites and products are real code on localhost, tested in the browser before reporting.
  Never an artifact for a site. An artifact is fine for a page to read, like a market map.
- **A video is final only with evidence.** A byte-size match with a file in `Desktop\Brands`, ARC
  `editr_outputs.kind = 'final'`, or a done `editr_tasks` row whose output is that file. A filename or folder saying
  "FINAL" is not evidence. `studio_votes` only covers ideas.
- **Partner work is never shown as BCON's own.** See the exclusions in `private/clients.md`.
- **No invented numbers.** Anything estimated is marked as an assumption, with what would confirm it.
- **Never say sound was checked** unless someone heard it. Tools can show levels, not whether it sounds right.
- **EDITR's rules apply to every video**, see `docs/studio/learning/01-house-rules.md`: images from ChatGPT only, video
  from ComfyUI only, ElevenLabs for music and voiceover only, frame 1 is the thumbnail, no em dashes.
- **Stills before video.** Z on the Amrit Slesha ads: jumping straight into videos "is not doing anything". Get good
  static creatives from ChatGPT first.

## How Z wants to work
- Z often works over Remote Control and may not see the app's next-step box, so the closing message has to stand alone.
- Side jobs go to their own subthread so master stays free. Z works in that thread directly.
- Portfolio work is grouped by brand, never by media type.
- Ads and PROXe are sold together to grow PROXe subscriptions, not agency fees. Judge those deals on whether PROXe is
  still paid for after month 3.
- When Z asks "where is X", Z wants the link or path, not a description of the work.

## Corrections Z gave this thread
| Date | Z said | What was wrong | What changed |
|---|---|---|---|
| 10-30 | "Stop building in artifact... It's not even moving" | Portfolio prototypes were artifacts | Real Next.js on localhost |
| 10-30 | "It's bending too much" | The flythrough bend made creatives unreadable | Bend, RGB shift and particles reduced twice |
| 10-31 | "Bring the actual icon itself... you're just using beacon as text" | Logo was typed, not the real mark | Real icon, particles trace it |
| 10-31 | (phone screenshot) | 16:9 footage cropped on phones | Whole frame over a dim copy on portrait screens |
| 11-02 | "You're uploading non-final videos" | I judged by filename and folder. Only 16 of 59 copies had evidence | Moved 43 to a holding folder. The evidence rule above |
| 11-02 | "That's not how I want it" (campaigns slider) | Scroll-snap fought the smooth-scroll library, and wheel scrolling was never tested | Rebuilt as a real slider |
| 11-02 | "Has to be so much more", "two cards are good for one line" | Portfolio felt thin | Pulled Drive and Instagram work, two cards a row, per-brand colours |
| 11-02 | "Stuff with more can be on the top" | Order was arbitrary | Brands sort by amount of work |
| 11-02 | "No, no" on the Amrit Slesha email | Z asked where the artifact was, I wrote an email | Read the whole request first. Find before you write |

## Mistakes of mine to keep avoiding
- Saying a brand might be misspelled or not exist, when it was real and already in another thread. Search the other
  sessions first.
- Saying something can't be done before trying it. I said large files couldn't go to Drive; `methods.md` shows they can.
- Treating a tool's "undelivered" as failure. Slow sessions still wake.
- Counting DOM elements in a dev build. `methods.md` explains why it double counts.
