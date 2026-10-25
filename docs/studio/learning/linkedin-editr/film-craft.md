# Film craft: what makes a PROXe launch / product film work

Learned on the PROXe V1 launch film (Oct 2026). Each point is something Z asked for or rejected.

## Story
- **Open on the pain, for everyone.** "We heard every business owner." PROXe is going international (UK first), so
  never say "Indian business owners" or show only Indian cues when the line is about everyone.
- **A launch has to be loud.** "It's a version 1 launch. It has to be loud." Bold, energetic narrator; keep all the
  content in, don't trim the story to make it calm.
- **Show the product meeting people at an emotional level, not a feature.** Z dropped the booking call ("everyone has
  shown booking") for a stranded caller: Maya breaks down on a highway at night, PROXe calms her, sends help in 12
  minutes and puts the driver's number on her WhatsApp. The narrative: PROXe's telephony understands how people feel.
  Make it visible: a caller-mood meter moving Anxious → Calm, "PROXe adapts · slower pace · warm tone".
- **Every scenario needs a believable setup.** A caller who says "I don't know who to call" makes no sense if she is
  calling a business. She calls a defined brand (a roadside-assistance company whose helpline PROXe answers), and her
  line must fit that. Define the brand before writing the scene.
- **Use names, local to the market.** PROXe says "Don't worry, Maya", not "don't worry yourself". Pick names that
  work in India and the US/UK (Maya, Riya Mehta).
- **Brain lines show intelligence, not data.** "Riya Mehta. She's been showing strong buying signals lately." beats
  a stage name or a score.
- **Full circle.** The film opens on its own end card ("PROXe V1 is here · Never miss a lead. Ever again.") held for
  ~0.4 s as the thumbnail, then plays, then ends on the same card.

## Brand
- **Brand wherever brand can sit.** "Hey PROXe" (not "Hey Brain"), "PROXe Brain", "Launching PROXe V1" (never
  "Introducing"), the V1 chip next to the logo. Write PROXe in brand case everywhere; speak it "Proxy".
- **"Launching", not "Introducing".** If the VO says one thing the screen must say the same word.
- **Fictional third-party brands are fine for scenarios** (Waylift 24/7 Roadside), but keep them simple. A big
  invented logo lockup was "overdoing it"; a small mark + name + "answered by PROXe" was enough.
- **Don't copy a reference brand.** The orb was asked to be "like Grok voice", then rejected when it became a copy.
  Take the feeling, make our own.

## The orb (PROXe's on-screen presence)
- Approved: **iridescent liquid chrome with a calm ripple** (WebGL shader `chromex` in `src/v1/OrbVariants.tsx`,
  settings `CALM` in `OrbV1.tsx`). Brand colours = the gradient (blue, pink, violet, orange reflections), not one hue.
- **It must never look dead.** When silent it keeps a slow organic wobble (amp floor 0.09 + 0.03·sin(0.8t)); when
  PROXe speaks the ripple rises with the voice.
- Rejected on the way: flat glass, particles rotating "for no reason", dot ripples, pulsing rings around it, a
  circle when the PROXe mark is an oval, too much movement. Show 4-6 variations as short videos, let Z pick.
- **On mobile it must be big and prominent** when PROXe is talking, so viewers know who is speaking. Label it
  ("PROXe listening / speaking") when space allows.

## Cards and screens
- **Frosted glass cards** (strong backdrop blur + saturation + brightness) so the gradient field glows through.
  Refractive, not flat.
- **Big and readable on a phone.** Z rejected screens "too small, not a lot visible": go close-up, crop to what
  matters. Recreate screens for 9:16 instead of cutting the 16:9 one down (it pixelates).
- **Important things in the visible middle of 9:16**; the top and bottom carry Instagram UI. Mockups can bleed off
  the edges; the content that matters stays in the safe band. Don't leave the bottom blank.
- **Show scale.** "Four coming in is not enough": show many leads across all channels at once.
- **Labels next to numbers.** A number alone ("47") needs its label right beside it ("leads lost").
- **Nothing overlaps.** Check orb vs number, cards vs charts, in both formats, at every beat.

## People and stills
- **Hyper-real, prompted like the real world** (ARC A-F template, `../../storyboard-prompting.md`): named camera +
  lens, ONE motivated light, real texture, avoid list. "Cinematic", mist, and stacked lights (hazards + headlights +
  interior) made the first Maya still "look exactly like AI".
- **Mobile versions of people shots are made for 9:16**, not cropped from landscape.
