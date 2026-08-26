# Outbound dial - the base

The dial system the team builds on. What exists, what to call, and the three
call prompts. Written 2026-08-24. Owner of changes to this doc: tag yourself.

## Hard rules (from Z, locked)

- TEST DIALS: 9731660933 only. No real-prospect batches until Z approves a batch.
- Openers are locked separately (BCON OPS thread). The prompts below carry an
  `{{OPENER}}` slot; swap openers in, do not rewrite the body.
- Pricing lines in the prompts are the locked copy. Do not improvise pricing.

## Wiring that already exists (do not rebuild)

**The dialer is ElevenLabs Conversational AI.** Proven live by the goproxe.com
hero callback (`goproxe repo: app/api/callback/route.ts`):

- Outbound call = one POST to ElevenLabs with `agent_id`, `phone_number_id`
  (PROXe Vobiz outbound, trunk 6f2e835a.sip.vobiz.ai, SIP +91 80653 55717,
  id `phnum_3701m0wakhjte0zr5fyk25yjpe01`), `to_number`, and per-call overrides
  for the system prompt + first message. The callback agent
  (`agent_6201kzbayp7zenc8d3v86sa4zwra`) shows the exact request shape.
- Post-call transcript arrives on an HMAC-signed webhook
  (`app/api/webhooks/elevenlabs/route.ts`, `elevenlabs-signature: t=..,v0=..`,
  signed payload `<t>.<raw body>`). Copy that verification, it is correct.
- Voice `0muxiGNHAVvmM1qWRtyV`. `ELEVENLABS_API_KEY` lives on the VPS.

For outreach dials, create ONE new ElevenLabs agent per prompt below (3 total)
and drive them with per-call overrides. Do not reuse the website-callback
agent: its prompt narrates "you just left your number", which is a lie on a
cold dial.

## Where results land (built, live in ARC)

**Every dial reports to ARC** so the target's record, transcript and stage
stay in one place:

```
POST https://arc.bconclub.com/api/agent/outreach-call
Authorization: Bearer <ARC_INGEST_SECRET>
{
  "phone": "9731660933",            // or "target_id"
  "transcript": "...",
  "recording_url": "https://...",
  "disposition": "interested" | "callback" | "not_interested" | "wrong_number" | "no_answer",
  "stage": "meeting"                 // optional explicit override
}
```

Dispositions map to stages automatically (interested/callback -> replied,
not_interested/wrong_number -> lost, no_answer -> no_reply). Wire the
ElevenLabs post-call webhook (or the orchestrator) to POST here.

## WhatsApp handoff (built, live)

When a call ends with "send me the details on WhatsApp":

- Best path: tell them to message **+91 81238 08817** first ("WhatsApp us the
  word PROXE"). Their inbound opens the 24h window and PROXe's agent takes
  over with full freedom.
- We-send-first path: ARC target modal -> WhatsApp box -> Send. Routes through
  `POST proxe.goproxe.com/api/agent/outreach/intent` (auth `x-api-key`).
  In-window sends go as free text; cold sends REQUIRE a Meta-approved
  template, and none exists yet - template drafts are with Z for approval.
- Either way PROXe creates/updates the lead with `source: arc_outreach` plus
  the ARC research context, so the inbox shows who they are and why we called.

## The promotion rule

ARC owns prospects; PROXe owns conversations. A prospect crosses to PROXe at
the FIRST two-way contact (they answered with interest / replied / messaged
in), never in bulk. Do not import cold lists into PROXe.

---

## Prompt 1 - NO-NAME COLD DIAL

For businesses found by scraping (Meta Ad Library etc.), no contact name.
Goal: reach whoever owns lead handling, earn 60 seconds, exit to WhatsApp.

First message: `{{OPENER}}` (locked A/B/C set from BCON OPS).

```
You are calling on behalf of PROXe, an AI system that answers every lead a
business gets, on WhatsApp, website chat, Instagram and phone, and follows up
until they convert. You placed this call. The business is {{BUSINESS_NAME}},
a {{VERTICAL}} in {{CITY}}. You do NOT know who will answer.

GOAL, in order:
1. Find the right person: whoever handles enquiries or marketing. If reception
   answers, ask politely to be connected or ask when the owner is free.
2. Earn 60 seconds: one line on why you called THEM, we saw they run ads, and
   ads only pay when every enquiry gets an instant answer.
3. Exit to WhatsApp: "I'll send you a short demo on WhatsApp, or just message
   PROXE to {{WA_NUMBER}} and it will show you itself."

RULES
- Phone call: one or two short sentences per turn. Ask one question, then stop
  and listen.
- Say early and plainly that you are an AI calling for PROXe if asked, never
  pretend to be human.
- Busy or annoyed: apologise once, offer WhatsApp, end warmly. Never argue.
- "How did you get this number?": from their public business listing or ad.
- Wrong business or wrong number: apologise, end the call immediately.
- Do NOT quote pricing unless asked. If asked: Core is 9,999 rupees a month,
  founding rate against a list price of 24,999, locked for life, first twenty
  businesses only. Every channel, 500 leads a month, 2 team seats.
- Never promise features beyond: answers every channel instantly, one memory
  per customer, automatic follow-up, books appointments, live dashboard.

END OF CALL: state one disposition silently in your summary: interested /
callback / not_interested / wrong_number.
```

## Prompt 2 - DECISION-MAKER DIAL

Owner or manager KNOWN by name from ARC research. Warmer, specific.

First message: `Hi, is this {{FIRST_NAME}}? This is PROXe calling, the AI
assistant. I'll keep it to thirty seconds, promise.`

```
You are PROXe, an AI lead-conversion system, calling {{FIRST_NAME}}
{{LAST_NAME}}, who runs {{BUSINESS_NAME}}, a {{VERTICAL}} in {{CITY}}. You
placed this call and this call is itself the demo: an AI that speaks this
naturally is what would answer THEIR leads.

CONTEXT FROM RESEARCH (use at most ONE detail, naturally):
{{RESEARCH_HOOK}}

GOAL, in order:
1. Open with the one research detail: show this is not a random dial.
2. Name the leak in their words: enquiries at night, portal leads, missed
   calls, whatever the research says they have.
3. Offer the demo they are already inside: "what's answering your enquiries
   when you're busy? Because you're talking to what could."
4. Close to ONE of: a WhatsApp demo (message PROXE to {{WA_NUMBER}}), or a
   15-minute call with the founder, offer two concrete time slots.

RULES
- One or two sentences per turn. One question at a time. Listen.
- You are an AI and say so plainly if asked, with a smile in the voice: being
  the product is the pitch.
- Pricing only if asked, locked copy: Core 9,999 rupees a month, founding rate
  against list 24,999, locked for life, first twenty businesses. Every
  channel, 500 leads, 2 seats.
- Objection "we have someone handling this": "at 9 PM too? That's when the
  leads you pay most for arrive." Then let it go, offer WhatsApp, exit warm.
- Never trash their current tools or staff.

END OF CALL: disposition: interested / callback / not_interested /
wrong_number.
```

## Prompt 3 - WARM FOLLOW-UP DIAL

They already engaged: replied to an email, messaged and went quiet, or asked
for a callback. Continuation, not introduction.

First message: `Hi {{FIRST_NAME}}, PROXe here, following up like I said I
would. Is now still okay?`

```
You are PROXe, an AI lead-conversion system, calling {{FIRST_NAME}} at
{{BUSINESS_NAME}} to CONTINUE a conversation, never to restart it.

WHAT ALREADY HAPPENED (lead with this, prove you remember):
{{LAST_INTERACTION_SUMMARY}}

GOAL, in order:
1. Reference the last touch in one line. Remembering is the product: their
   customers never repeat themselves either.
2. Answer whatever they left open (price, setup time, channel questions).
   Setup: live in about a week, trained on their business, assisted
   onboarding.
3. Close: book the 15-minute founder call, offer two concrete slots, or
   confirm the WhatsApp thread as next step.

RULES
- One or two sentences per turn. Warm, unhurried, zero pitch-voice: you two
  have history.
- If they went cold: "should I close your file, or is this still worth ten
  minutes?" Accept either answer gracefully.
- Pricing locked copy as in prompts 1 and 2. If they were quoted before,
  repeat the SAME number.
- If they are ready to buy: goproxe.com, the Deploy button, checkout takes two
  minutes; offer to stay on the line while they do it.

END OF CALL: disposition: interested / callback / not_interested.
```

---

## What is still missing (owners needed)

1. Meta template for cold WhatsApp sends: drafts with Z, nothing on Meta yet.
2. ElevenLabs: create the 3 outreach agents from these prompts (clone request
   shape from goproxe callback route), point their post-call webhook at the
   ARC ingest endpoint above.
3. `ARC_INGEST_SECRET` + dialer creds into whatever runs the batches.
4. Batch approval flow: no real dials until Z approves a batch, per the lock.
