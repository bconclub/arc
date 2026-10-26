# Handoff to the full-time GTM agent

> **Date:** 2026-10-26  
> **From:** Axlrate PROXe GTM session (Z's GTM strategy thread)  
> **Use it:** The full-time GTM agent and its sub-agents (outbound writing, logging, social). Pick these up and run
> them there. Every send, post or spend still waits for Z (brief rules).

Read first, in order: ARC `gtm_brief` and `gtm_plans` (source of truth), then [method.md](method.md),
[founder-feedback.md](founder-feedback.md), and the file named in each task.

## Run now
1. **30-account call pilot (India).** Bigger, better players: owner-led clinics/hospital groups, coaching chains,
   real estate developers, wellness, multi-branch businesses, auto dealers, 30-100+ enquiries a day, Bangalore first.
   - Data: Apollo free people search (founder / owner / CEO / MD, 30-200 staff, India) for names and LinkedIn links,
     free; mobiles from Apollo's free credits only (8 credits a phone, about 35 phones in the 282 left). No paid plan.
     Also work ARC Outreach's ~650 unworked "identified" targets (Maps, Aug sheet, Ad Library), free.
   - Show Z the list before spending any credit; Z cuts it.
   - Touches: call (Z for the top 10; PROXe voice agent for the rest once Z approves the script), WhatsApp after a
     call, LinkedIn connect. Flow, timing and messages: [messaging-kit.md](messaging-kit.md). Script: [tools.md](tools.md).
   - Log every touch in ARC `outreach_targets` / `outreach_activity`; yeses become PROXe leads; TEMQ words vs actions
     and the commitment point go to `proxe_commitment_matrix`.
2. **Daily social.** 08:30 weekday kit for Z (15 connects with links, 8 posts with draft comments, 1 X post), Z sends
   by hand, log it, Friday review. Rules and voice: [social-playbook.md](social-playbook.md). No LinkedIn automation.
3. **Investors and events.** Next actions at the end of [investors-and-events.md](investors-and-events.md): warm intro
   paths to Artha India Ventures and Claypond first; Bengaluru Tech Summit (17 to 19 Nov) investor programme
   application is free, the Rs 30,000 + GST booth is Z's call; check DIDAC (25 to 27 Nov) stall cost.

## Outbound callers: ready (from PROXe Core, 26 Oct, on Z's go)
- **Agents** (ElevenLabs, all on the Sanket voice): Intro Cold (`noname`, V4: "Hi, is this {business}?", the opener,
  then "who am I speaking with", goal ~30 s and a callback time for Thanzeel, end reason `callback_requested`);
  Intro DM (`dm`: "Hi, is this {first_name}?" then the opener); Follow-up (`warm`: needs `last_summary`, no re-pitch).
  All: one question per turn, never repeat, kind exit on no, price only if asked (Rs 9,999 + GST, 7-day trial,
  1,000 leads + 250 AI voice min, 2 seats).
- **Openers to A/B test** (`opener` 1-5 in the dial body, logged as `opener_variant`): 1 "Hi, I'm Proxy, an AI,
  calling to introduce myself. Can I have thirty seconds?" 2 "...Is this a good time?" 3 "Hi, I'm Proxy, an AI for
  your leads. Got a minute?" 4 "...I saw your ads on Facebook and wanted to introduce myself..." (only for prospects
  that really run ads) 5 "...I saw your ads on Facebook and I'm just calling to chat about them..." DM versions add
  "Hi {first_name}," in front.
- **How to dial:** goproxe.com/bdr (opener picker + listen list), or `POST goproxe.com/api/outreach-dial` with
  `Bearer DIAL_API_KEY`: `{ phone, agent: "noname"|"dm"|"warm", opener: 1-5, target_id, vars: { business_name,
  vertical, city, first_name, last_summary } }`. ARC reserves first (24 h cooldown). Scripts:
  `GET /api/outreach-dial/agents` (operator session).
- **Clear before volume (Z's calls):** bot dials are locked to `DIAL_ALLOWLIST` (one test number today), widen per
  approved batch; quiet hours 8 PM to 9 AM IST; TRAI: promotional cold calls should come from a 140-series number and
  skip DND numbers, today's caller ID is a normal number (+91 80653 55717); one live test each of Intro DM,
  Follow-up and Intro Cold's newest opening to the test number before the first batch.
- **Measure per opener:** interested + callback_requested per 100 connected (September baseline: 6 interested of
  59 connected).

## Not now
- No cold email to India. UK cold email only after: separate lookalike domain on Workspace with SPF/DKIM/DMARC,
  2-week warm-up, UK postal address + unsubscribe, GBP price, sender decided (Z or BVCL). See messaging-kit.md.
- No Instantly, no Apollo sequences, no Apollo inbox linking, no paid Apollo plan.

## Waiting on Z (ask, don't assume)
- Outbound call script go (PROXe says it is an AI; one agent instead of three).
- Cold WhatsApp to Apollo numbers as Marketing templates, or call + LinkedIn only until they reply (recommended).
- Calculator link: make it public or move to goproxe.com/calculator (recommended).
- "Website + PROXe live in 7 days" offer line, booking link, UK GBP price, UK sender.
- Council #14a / #15 sprint written into the brief; Scale card; BCON's own ICP; PROXe prompt price fix
  (web.ts quotes 500 leads + 100 min, Core is 1,000 + 250).

## Housekeeping found on the way
- Google Workspace payment for bconclub.com failed on 3 Oct (card declined): Z to confirm billing.
- An automated email from bconclubx@gmail.com to connect@bconclub.com bounces every 3 days.
