# Studio storyboards: how we prompt and how we check

The house standard for every reel-idea storyboard we make for a client board (ARC Studio). Every editor and agent (EDITR Main, Social Editr, Insta Daemon, ARC Studio) uses this. Do not invent a new format per brand.

## 1. The fixed format (never changes)

- **One image per idea**, attached to the idea on the board (`studio_items` kind `image`, `parent_id` = the idea).
- **Six frames of the reel**, each a **tall vertical 9:16 frame** (phone shape). Never square.
- **Layout:** 3 frames across, 2 rows, on a plain cream background with even margins. Frames read left to right, top to bottom.
- **No text** anywhere: no numbers, captions, supers, watermarks or UI.
- **No invented packaging, labels or logos.** Show the brand's real pack only when we have a real photo of it.
- **Final file:** JPEG about 1080 px wide, quality about 85, around 250 KB.

## 2. The prompt template

Fill every block. The blocks are the same for every frame and every idea of a brand; only block E changes. Write the brand blocks (B, C, D) once per brand, save them on the board as a team note, and paste them verbatim every time. Reusing the same words is what keeps frames consistent.

```
[A] FORMAT
Storyboard for a vertical Instagram reel: ONE image containing SIX tall vertical 9:16 frames,
3 across and 2 rows, on a plain cream background with even margins, read left to right, top to
bottom. Every frame is a real photograph. No text, numbers, captions, logos or packaging anywhere.

[B] PRODUCT TRUTH  (written from real photos or the client's own words, never from their AI renders)
<what it is, size in cm, shape, surface, colour, how it is held or eaten; the variants and how
they differ visually>

[C] LOOK  (the brand's camera and grade, fixed for the whole board)
Real candid photograph, not a render. Shot on <35mm film, Kodak Portra 400 | an iPhone>, natural
grain. One motivated light source: <soft window light from camera left | late-afternoon sun |
overcast daylight>, soft natural shadows, no studio lighting, no rim light. Colour grade: <warm,
slightly desaturated, earthy browns and cream with deep-teal accents>. Real texture: skin pores,
fine hair, fabric weave, crumbs, smudges, wear. Lived-in <Bangalore home | office | park>, not
styled or staged.

[D] CAST  (only if people appear; the exact same words in every prompt)
Person A: <age, build, skin tone, hair, clothes>. Person B: <...>. Ordinary people, natural
expressions, no model poses, no makeup glow.

[E] SHOT LIST  (one line per frame: shot size, angle, lens, action, light or composition note)
1) <wide | medium | close-up | extreme close-up>, <eye level | high | low | top-down>,
   <24mm | 35mm | 50mm | 85mm | 100mm macro>, <what happens>, <where the light falls>
2) ...
6) ...

[F] AVOID
CGI or 3D render look, glossy plastic surfaces, perfect symmetry, glowing edges, HDR, oversharpening,
waxy or airbrushed skin, extra or warped fingers, floating objects, cinematic teal-orange grading,
stock-photo smiles, any text or lettering, invented logos or packaging.
```

### Why it is written this way (sources at the end)

- **Say "real photograph" and describe it like a photo being taken.** Use lens, framing and light, and ask for real texture (pores, fabric wear, imperfections). Avoid words that imply studio polish. This is OpenAI's own guidance for its image models.
- **Lens and framing words steer realism better than "8K" or "ultra-detailed".** Drop those tags. Name a focal length, not an adjective:
  - 24–35 mm for place and scale.
  - 50 mm for people at a natural distance.
  - 85 mm for faces.
  - 100 mm macro for product detail.
- **One motivated light source.** Several sources read as a studio. Name where the light comes from and how soft it is; "warm lighting" means nothing.
- **Name the grade and the film stock.** That sets the mood faster than any adjective.
- **State the shot size for every frame.** Leave it out and the model defaults to a flat, eye-level medium shot.
- **Consistency comes from fixed words and references.** Keep blocks B, C and D identical, keep the same chat, and upload reference photos (the real product, a real look reference, or the approved frame).

## 3. Workflow

1. **Intake facts first.** Write block B only from the brand's real photos or their own words.
   - If their posts are AI renders, they are not proof of what the product looks like. Cravio's reels showed big round balls; the real product is a small oval coffee bean dragée.
   - If unsure, ask the client before making anything.
2. **One approved image first.** Make storyboard 1, check it (section 4), and get Z's OK on the look before making the rest.
3. **Same chat for the whole brand.** Upload the approved storyboard as the reference for the rest ("same product, people, light and grade as the reference").
4. **Fix with small edits.** Change one thing per retry ("make the dragées smaller and oval, keep everything else") instead of rewriting the prompt.
5. **Export:**
   - Get the image out of ChatGPT. Use a download if the browser allows it; otherwise draw it full-width in thirds, screenshot each third, and stitch the thirds back on the PC (scratchpad `imgtool/stitch.js`).
   - Compress the stitched image to a 1080-wide JPEG.
   - Upload it to storage `studio/<brand>/boards/`.
   - Attach it to the idea.
6. **Write house notes on the board** for anything done differently from this file, so the next editor knows.

## 4. The check (every storyboard, before it goes on a board)

Reject and regenerate if any of these fail:

| Check | Pass when |
|---|---|
| Format | One image, six tall 9:16 frames, 3x2, cream margins, no text |
| Product truth | Shape, size and colour match block B in every frame where it appears |
| Real photo | Would pass as a phone or film photo at a glance: grain, real skin, imperfect surfaces |
| Hands and bodies | Five fingers, natural grip, no melted or extra limbs |
| Consistency | Same people, clothes, place and grade across all six frames |
| Light | One believable source, no studio rim light or glow |
| Story | Frames 1 to 6 read as the idea, in order, without explanation |
| Brand safety | No invented packaging, labels or logos; no claims shown (health, eco, energy) unless cleared |
| Colours | Brand palette appears naturally in props, walls, cloth and cups, not as graphics |

The first time a brand's storyboard passes, post it to Z for a yes before making the rest.

## Sources

- [OpenAI image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting)
- [OpenAI cookbook: GPT image models prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)
- [OpenAI cookbook: gpt-image-1.5 prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-1.5-prompting_guide)
- [Img2Go: cinematic AI image prompts](https://www.img2go.com/blog/cinematic-ai-image-prompts)
- [Rephrase-it: prompt formulas for lighting, style and composition](https://rephrase-it.com/blog/ai-image-prompt-formulas-for-lighting-style-and-composition-)
- [Lovart: storyboarding with a consistent character](https://www.lovart.ai/pt/blog/storyboarding-consistent-character-video-script-ai)
- [Longstories: common AI storyboarding mistakes](https://longstories.ai/blog/avoiding-common-ai-storyboarding-mistakes)
