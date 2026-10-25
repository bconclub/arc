# Case study: PROXe V1 launch film (EDITR task T20)

87 s, 30 fps, 16:9 (LinkedIn) + 9:16 (stories). Final v04 on Drive, Brands/PROXe/v1-Launch/Final (2026-10-21).

## What it says
PROXe V1 makes sure no lead is ever missed, on any channel, at any hour, and handles each one with real feeling.

## Beats
| Time | Beat | Line |
|---|---|---|
| 0:00 | Thumbnail | End card held 0.4 s: "PROXe V1 is here · Never miss a lead. Ever again." |
| 0:00 | Pain | "We heard every business owner." (owners, fast cuts) |
| 0:03 | Build | "12 months. Thousands of iterations." |
| 0:07 | Reveal | "Launching PROXe V1." (orb, logo, V1 chip) |
| 0:09 | Origin | "PROXe started from one pain... Today, PROXe is a being of its own." |
| 0:21 | Voice | "And now, PROXe doesn't just answer calls. It understands how people feel." |
| 0:28 | Call | Maya: "Hi... my car just broke down on the highway. It's late." |
| 0:32 | Call | PROXe: "Don't worry, Maya. Help is on its way. Our team will reach you in 12 minutes, and I've sent the driver's number to your WhatsApp." (mood meter Anxious → Calm, "Help arriving in 12 min") |
| 0:40 | Call | Maya: "Thank you." |
| 0:42 | Everywhere | WhatsApp, Instagram DMs, comments, Facebook, website. "Wherever your customers are, PROXe is there." |
| 0:51 | Brain | "And behind every conversation, there's PROXe Brain." |
| 0:54 | Brain | Owner: "Hey PROXe, who should I call first today?" Brain: "Riya Mehta. She's been showing strong buying signals lately." |
| 1:01 | Team | "Your whole team. Every call. Every follow-up. In one place." |
| 1:06 | Tools | WhatsApp Balancer (no bans, every message visible); Conversions API (leads back to Meta, audiences built) |
| 1:21 | Promise | "PROXe V1 is here. Never miss a lead. Ever again." |

## Spend
$7.30 of the $5-8 budget: owner clips and lip-syncs $6.16, one rejected Maya clip $0.50 (AI-looking still), the
accepted Maya clip $0.50, two lip-syncs $0.14. Lesson: the $0.50 loss came from a still that wasn't prompted like a
real photo; fix the still before spending on motion.

## Tried and dropped
- Booking call (too common) → emotional roadside call.
- "Introducing" → "Launching". "Hey Brain" → "Hey PROXe".
- Plain "v1.0" frame-0 overlay → the end card as the opening.
- Many orb looks (glass, dots, particles, rings, Grok-like) → iridescent chrome calm ripple.
- Big fictional-brand lockup → small brand line ("overdoing it").

## Reuse
- Orb: `proxe-clips/edit/src/v1/OrbVariants.tsx` (`chromex`) + `OrbV1.tsx` (`CALM`). Spec also with PROXe Core for
  the live dashboard Brain.
- Mix: `EDITR/tasks/T20-proxe-v1-launch-film-x-ai-style-brain-lo/audio/mix_v13.py`.
- Render + checks script pattern: see pipeline-and-tools.md.
