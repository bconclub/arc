# Handoff to the full-time GTM agent

> **Date:** 2026-10-26 (session 08 tasks added 2026-10-28)  
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

4. **From session 08 (28 Oct, [session-08.md](session-08.md)):**
   - TEMQ Money (Actions) = 1 until finance/invoice/payment actions; rescore the sheet and `proxe_commitment_matrix`
     on that rule (Gravity Academy's 4 was price talk, not action). PROXe's note scorer needs the same rule (PROXe Core).
   - Cold or stalled pipeline (Genie Bikez first, then Frank Public School, Vidya, AsquareB): draft one pain-trigger
     message each, with their own numbers (Genie: ~Rs 40K a day at stake). Outcome is a reply. Z sends.
   - Before every call or visit, write its one outcome in the account note. Z walks into 3 businesses this week.
   - No free websites/setup offered before pain and value land, and never a payment link before alignment.

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
- **26 Oct, after the pause (PROXe Core 2e5c601, calling resumed on Z's go):**
  - Intro Cold never says the business name ("Hi, am I speaking with the {vertical}?").
  - All three agents wait for "Hello?" before speaking, hang up silently on IVR menus, never speak their reasoning,
    and ask once for a time ("tomorrow morning or afternoon?") instead of ending on "thank you".
  - The model stays as ElevenLabs has it (Z: don't plug in our own).
  - Send `vertical` as the plain type ("dental clinic", "coaching centre"), never "business"; spokenBusinessName
    drops areas, commas and slash words.
  - On every booking, send `industry` (or `vertical`) and `city` to PROXe `/api/agent/outreach/call-booking`; it
    sends WhatsApp template `proxe_demo_confirm_v1` (date + time) and sets Last touch to WhatsApp.
  - Calls tab shows opener chips, "Connected · Call booked", "IVR drop", and why a call didn't ring (SIP code + side).
  - Known, unfixed: one-way audio on some calls (prospect keeps saying "Hello?"); a fair share of SIP 403 / timeouts
    on our line. Watch "Didn't ring" reasons and tell PROXe Core if 403 ("Network refused our call", our side) climbs.
  - Earlier on 26 Oct (~4:30 PM) calls went out that did not pass ARC's reservation step and Z paused calling;
    every dial must go through `/api/outreach-dial` so ARC reserves it.
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
