# Caller changes log (newest first). Backups of each agent version: Z's Mac, ~/Builds/god/outbound/agent-backup-*.json

| Date | Agent | Change | Why | By |
|---|---|---|---|---|
| 2026-11-12 | Intro Cold | Prompt: "Who we are, when they ask" (Proxy from Beacon Club, founder Thanzeel Ashruf, marketing + lead systems across Bangalore) + pronunciation guide. | Z feedback 12 Nov | GOD |
| 2026-11-11 | Post-call (ARC mirror + PROXe) | Fix: an agreed clock time in callback_request now books in PROXe (lead + booking + standard `proxe_demo_confirm_v1`) for any callback/interested call, whoever answered and however the summary words it. Before: booking needed the summary to say founder/demo AND not front desk, so "busy, call me tomorrow 11 am" only made a lead with no booking (Rayara, Akshara, Shaakya, SME) and FitFlix (front desk) got nothing. Not a missing reservation: ingest matches by phone already. Parser: added "2026-11-12", "12 Nov", and "next Thursday" (said on Wednesday = the 19th). Duplicate-safe (PROXe dedupes on conversation_id). Backfilled 5 calls, confirmations sent: FitFlix 12 Nov 7:30 PM (today's 7:30 passed before the booking; moved by hand), Shaakya Spa 12 Nov 11:00, Rayara Kirana 12 Nov 10:30 ("by 11"), Akshara Little Bees 12 Nov 11:30 (11:00 was taken: PROXe allows one booking per slot), SME Tours 19 Nov 1 PM ("next Thursday"). | Z, 11 Nov | Dev |
| 2026-11-10 | Post-call (ARC mirror + PROXe) | New: when callback_request mentions WhatsApp, ARC mirror calls PROXe `POST /api/agent/outreach/whatsapp-details`, which sends template `proxe_call_details_v1` (one send per conversation_id, logged in the lead chat and `proxe_outbound_activity` `wa_details:<conv>`). Test targets: only +91 97316 60933. Sends nothing until the template is approved in Meta and `PROXE_CALL_DETAILS_APPROVED=1` is set in PROXe; until then status `pending_template`. No agent prompt change. | Z feedback 10 Nov (WhatsApp details) | Dev |
| 2026-11-11 | Intro Cold | Prompt: "If the line is not clear, end and call back later" (outcome no_answer + callback_request "bad line, call back"); GOD dialler requeues those. Also a do-not-call list of clients/partners in GOD's dialler. | Z feedback 11 Nov | GOD |
| 2026-11-11 | Intro Cold | Prompt: "When they want to end, let them" (one closing line, no more pitch). | Z feedback 11 Nov | GOD |
| 2026-11-10 | Intro Cold | Data collection `call_outcome`: interested only on an explicit ask; a yes followed by a drop is connected. | Z feedback 10 Nov (false "interested") | GOD |
| 2026-11-10 | Intro Cold | Prompt: "Send it on WhatsApp" (confirm, check number, ask follow-up time, outcome interested + WhatsApp details). Post-call WhatsApp send handed to Dev. | Z feedback 10 Nov | GOD |
| 2026-11-10 | Intro Cold | Prompt: "Your very first line: say their name" ("Hi, is this {business_name}?", type only if unsayable; never speak reasoning). Dialler sends a short sayable `business_name` (drops branch, area, Pvt Ltd). | Z feedback 10 Nov | GOD |
| 2026-10-30 | Intro Cold | Prompt: "Use their name" (never "the clinic / coaching centre / sir"). | Z feedback 30 Oct | GOD |
| 2026-10-30 | Intro Cold | Prompt: "A question is not a no". | Z feedback 30 Oct | GOD |
| 2026-10-26 | Intro Cold | V4 script, 5 openers, `intro_line` variable. | Z / PROXe Core | PROXe Core |

## Known gap (10 Nov)
GOD's dialler on the Mac (`~/Builds/god/batch-dial.py`) has been dialling ElevenLabs directly since 26 Oct, so ARC shows
no reservations for those calls (results still reach ARC through the post-call webhook). Moving it to reserve in ARC
first (rule 3) is in progress.
