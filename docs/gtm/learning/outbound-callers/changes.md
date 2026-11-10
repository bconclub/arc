# Caller changes log (newest first). Backups of each agent version: Z's Mac, ~/Builds/god/outbound/agent-backup-*.json

| Date | Agent | Change | Why | By |
|---|---|---|---|---|
| 2026-11-10 | Intro Cold | Prompt: "Send it on WhatsApp" (confirm, check number, ask follow-up time, outcome interested + WhatsApp details). Post-call WhatsApp send handed to Dev. | Z feedback 10 Nov | GOD |
| 2026-11-10 | Intro Cold | Prompt: "Your very first line: say their name" ("Hi, is this {business_name}?", type only if unsayable; never speak reasoning). Dialler sends a short sayable `business_name` (drops branch, area, Pvt Ltd). | Z feedback 10 Nov | GOD |
| 2026-10-30 | Intro Cold | Prompt: "Use their name" (never "the clinic / coaching centre / sir"). | Z feedback 30 Oct | GOD |
| 2026-10-30 | Intro Cold | Prompt: "A question is not a no". | Z feedback 30 Oct | GOD |
| 2026-10-26 | Intro Cold | V4 script, 5 openers, `intro_line` variable. | Z / PROXe Core | PROXe Core |

## Known gap (10 Nov)
GOD's dialler on the Mac (`~/Builds/god/batch-dial.py`) has been dialling ElevenLabs directly since 26 Oct, so ARC shows
no reservations for those calls (results still reach ARC through the post-call webhook). Moving it to reserve in ARC
first (rule 3) is in progress.
