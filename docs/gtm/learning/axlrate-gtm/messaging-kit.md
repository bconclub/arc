# PROXe outbound messaging kit (draft, 26 Oct 2026)

> **Date:** 2026-10-26  
> **From:** Messaging sub-agent of the Axlrate PROXe GTM session (drafts, inbox check of brands@bconclub.com)  
> **Use it:** Outbound writers (WhatsApp, LinkedIn, post-call email, UK cold email) and the outreach logger


Status: DRAFT. Nothing here has been sent. Every send waits for Z.
Built on: method.md, plan.md, tools.md, founder-feedback.md, council/rules.md.

Merge fields: `{name}` first name, `{company}`, `{city}`, `{segment}` (clinic, coaching centre, project...),
`{enq_day}` enquiries a day they told us, `{loss_month}` Rs lost a month from the calculator,
`{calc_link}` Lead Leak Calculator, `{video_link}` 2-minute video, `{booking_link}` 15-minute slot with Thanzeel.

Rules every message follows
- Their pain first. The product comes only after they have named a pain.
- One question per message. Easy to answer: a number, a yes/no, or two fixed time slots.
- Use their numbers only. Never inflate the loss.
- No "no pressure at all", no guilt lines, no fake deadlines, no discounts, no GST waivers.
- "Don't call / don't message" = do-not-contact on every channel, logged the same day.
- Price, if asked: "Rs 9,999 a month plus GST, with a 7-day trial after a Rs 100 card check."
- The 7-day offer ("website + PROXe live in 7 days") is marked [7-DAY]. Use it only once Z approves it in the brief.

---

## 1. India pilot: 30 accounts, 3 touches

Who: the 30 best bigger players from Apollo, 30 to 100+ enquiries a day, owner or decision maker reachable.
Before Day 0: DND-scrub every number (TRAI), call from the 140-series line, outbound WhatsApp from the separate
outbound number (never the main inbound number).

| Day | Touch | Trigger | Message |
|---|---|---|---|
| 0 | Call (PROXe AI, script in tools.md) | Everyone | Opening: "Hi {name}, this is PROXe. I'm an AI, and I'm calling to introduce myself." |
| 0 | WhatsApp W1 "as promised" | Call connected and they said yes / "send it" | Within 10 minutes of the call |
| 0 | WhatsApp W2 no-answer opener | Call not answered, or cut before the question | 2 to 3 hours after the call, business hours |
| 1 | LinkedIn connect L1 | Everyone not already "no" | From Z's personal profile |
| 1+ | LinkedIn first message L2 | When they accept | Same day as accept |
| 3 | WhatsApp W3 follow-up | No reply since Day 0 | 10:30 to 12:00 or 16:00 to 18:00 |
| 3 | Second call attempt (optional) | Day 0 not answered | Different time slot from Day 0 |
| 7 | WhatsApp W4 close-out | Still no reply | One calm close-out, no more chasing |
| 10 | Mark lost | 3 days silent after W4 | Status lost, reason "no reply", monthly check-in date set |

Stop the sequence on any reply on any channel. A reply moves to a conversation, and the conversation ends with a
commitment point (card check for the trial, pilot fee, or a decision date written down).

Weekly scoreboard for the pilot: touches done, connects, pain in Rs captured, commitment points, trials, first charges.

---

## 2. WhatsApp

### Template note (Meta WhatsApp Business API)
- Any message we start outside a 24-hour window (they have not messaged us in the last 24 hours) must be an
  approved template. A call does not open the window. So W1, W2, W3 and W4 are ALL templates.
- Category: Marketing for all four (W1 could be argued as Utility, but it mentions an offer link; file as Marketing
  to avoid rejection and a quality hit).
- Template rules applied below: variables as {{1}}, {{2}}; no variable at the very start or end; no two variables
  side by side; links as a URL button where possible; no ALL CAPS, no emoji walls.
- Once they reply, the 24-hour window opens and we can write freely (objection replies in section 6).
- Opt-in: council rule says outbound WhatsApp only to people who opted in. W1 is fine (they said yes on the call).
  W2, W3 and W4 to a number that never opted in are a Z decision (see decisions at the end).

### W1. After a call, "as promised" (Marketing template `proxe_after_call_v1`)
Free-form version:
> Hi {name}, as promised after our call. You mentioned about {enq_day} enquiries a day at {company}. This
> calculator shows what the unanswered ones cost in a month, with your numbers: {calc_link}
> 2-minute video of how the replies work: {video_link}
> Shall I keep a 15-minute slot with Thanzeel this week?

Template form:
> Hi {{1}}, as promised after our call. You mentioned about {{2}} enquiries a day at {{3}}. This calculator
> shows what the unanswered ones cost in a month, using your own numbers. Shall I keep a 15-minute slot with
> Thanzeel this week?
Buttons: URL "Open calculator" ({{calc_link}}), URL "Watch 2 min", Quick reply "Yes, book a slot".
(49 words)

### W2. No-answer opener (Marketing template `proxe_missed_call_v1`)
Free-form version:
> Hi {name}, PROXe here. I tried calling {company} today. Quick question, no pitch: when an enquiry comes in on
> WhatsApp or Instagram after 8 pm in {city}, who replies to it, and how fast? Reply with a rough time, like
> "next morning".

Template form:
> Hi {{1}}, PROXe here. I tried calling {{2}} today. A quick question, no pitch: when an enquiry comes in after
> 8 pm, who replies to it, and how fast? Reply with a rough time, for example "next morning".
Buttons: Quick reply "Within minutes", Quick reply "Next morning", Quick reply "Not sure".
(44 words)

### W3. Day 3 follow-up (Marketing template `proxe_followup_v1`)
Free-form version:
> Hi {name}, one number from businesses like {company}: when a reply takes longer than an hour, most of those
> enquiries have already called someone else. If unanswered enquiries are still a problem at {company}, roughly
> how many come in on a busy day? A number is enough.

Template form:
> Hi {{1}}, if unanswered enquiries are still something you want to solve at {{2}}, roughly how many come in on
> a busy day? A number is enough, and I will send back what that costs in a month, using only your figures.
Buttons: Quick reply "Under 15", Quick reply "15 to 50", Quick reply "50+".
(45 words)

Note: the free-form line "most of those enquiries have already called someone else" is a general claim. Keep it
only if Z has a source or our own PROXe data for it; otherwise use the template form, which makes no claim.

### W4. Day 7 close-out (Marketing template `proxe_closeout_v1`)
Free-form version:
> Hi {name}, I will stop here so I don't crowd your WhatsApp. Let me know where you'd like to take this for
> {company}: "yes, call me", "later" or "not for us". Any answer works, it helps me plan.

Template form:
> Hi {{1}}, I will stop here so I don't crowd your WhatsApp. Let me know where you'd like to take this for {{2}}.
> Any answer works, it helps me plan.
Buttons: Quick reply "Yes, call me", Quick reply "Later", Quick reply "Not for us".
(30 words)

"Later" gets the Diwali/stall reply in section 6. "Not for us" gets one line of thanks and status lost.

---

## 3. LinkedIn (from Z's personal profile)

### L1. Connection note (under 300 characters, no pitch)
> Hi {name}, I work with {segment} owners in India on how they handle enquiries from WhatsApp, Instagram and
> calls. {company} came up as one of the busier ones in {city}. Would be good to be connected.

(~200 characters with average merge values. Check the final length after merge; LinkedIn cuts at 300.)

### L2. First message after they accept
> Thanks for connecting, {name}.
> One question I ask every {segment} owner: on a busy day at {company}, how many enquiries come in, and how many
> get a proper reply within the hour?
> No pitch. If the gap is big, I have a small calculator that puts it in rupees with your own numbers. Happy to
> share.

If they answer with numbers: send `{calc_link}` with their numbers filled in and ask for the 15-minute slot.
If they say "what do you do?": "We built PROXe. It answers every enquiry on WhatsApp, Instagram, website and calls
in under a minute, day or night, and follows up until they book. Is that a gap at {company} right now?"

---

## 4. Post-call email (India, only after a conversation)

Send from: brands@bconclub.com (warm, authenticated; see inbox check). Plain text, no images, one link block.

Subject: {company}: the enquiry numbers from our call

> Hi {name},
>
> Thanks for the time today. Here is what you told me, put in one place:
>
> - Enquiries a month: {enq_month}
> - Enquiries that don't get a proper reply: {unanswered_pct}%
> - Value of one customer: Rs {customer_value}
> - What the unanswered ones cost: about Rs {loss_month} a month, Rs {loss_year} a year
>
> These are your numbers, not ours. The full working is here: {calc_link}
>
> PROXe costs Rs 9,999 a month plus GST. The trial is 7 days, after a Rs 100 card check.
> [7-DAY] We can have your website and PROXe live in 7 days.
>
> If you want to see it running on your own enquiries, pick a 15-minute slot: {booking_link}
> Or reply with a date by which you will decide, and I will hold off until then.
>
> Thanzeel
> PROXe, BCON Club, Bangalore
> {phone} | goproxe.com

The last line is the commitment point: a slot, or a decision date.

---

## 5. UK cold email (LATER, not before the UK domain is set up and warmed)

Not before: a separate lookalike domain on Google Workspace (never bconclub.com or goproxe.com), SPF + DKIM + DMARC,
2 weeks warm-up, real UK postal address and an unsubscribe line in the footer (UK PECR / GDPR legitimate interest
for B2B: business addresses only, easy opt-out). Price in GBP waits for Z (`{gbp_price}`). BVCL (bvcl.uk) role
and whose name signs is a Z decision.

Tone: quiet, short, no exclamation marks, no "AI" in any subject line. 4 steps, stop on reply.

### UK-1 (Day 0): the question
Subject: enquiries after hours at {company}
> Hi {name},
>
> A quick question rather than a pitch. When someone enquires at {company} in the evening or at the weekend,
> through the website, WhatsApp or Instagram, how long does it usually take before they hear back?
>
> I ask because that gap is where most of the lost enquiries we see go missing.
>
> Thanzeel

### UK-2 (Day 3): the number
Subject: re: enquiries after hours at {company}
> Hi {name},
>
> If it helps, this short calculator puts the cost of slow replies in pounds, using only your own figures:
> enquiries a month, what one customer is worth, and how many go unanswered. {calc_link_gbp}
>
> It takes about a minute. Would the number be useful to you?
>
> Thanzeel

### UK-3 (Day 7): a short case
Subject: how {case_segment} handles it
> Hi {name},
>
> {case_one_line: a real PROXe client, segment, before and after reply time, with their permission}.
>
> What changed was simple: every enquiry gets a reply within a minute, day or night, and a follow-up until it
> books. The cost is {gbp_price} a month.
>
> Is reply time something you are looking at this quarter?
>
> Thanzeel

(Do not send UK-3 until a real case exists that the client has agreed to share. No invented case.)

### UK-4 (Day 14): close
Subject: closing the loop
> Hi {name},
>
> I won't keep writing. If reply time on enquiries is something you would like to look at later, just reply
> "later" and I will check back in a couple of months. If not, no reply needed.
>
> Thanzeel

Footer on every UK email: name, company, postal address, "Reply 'stop' and I won't write again."

---

## 6. Objection replies (Z's tone: calm, about their problem, take it or leave it)

### "It's too expensive" / "What's the price?"
> Fair question. It's Rs 9,999 a month plus GST. You told me about Rs {loss_month} a month is going unanswered
> today. If that number is right, is the price the real issue, or is it whether it actually works on your
> enquiries? The 7-day trial is there for the second one.

(Never discount. If they still say no: "Understood. If the number changes, you know where to find me.")

### "We already have someone / a team / a tool for this"
> Good, then you already know the problem matters. One check: what happens to an enquiry that comes in at
> 11 pm on a Sunday? If your team has that covered, you don't need us. If not, that's the only gap we'd fill.

### "Send me the details"
> Happy to. So I send the right thing and not a brochure: how many enquiries come in on a busy day, and roughly
> how many get a reply within the hour? With those two numbers I'll send you what it's costing, in rupees.

(Details without a pain number is a value-provider move. Get the number, then send the calculator.)

### "Call me after Diwali" / "Next month" (the stall: name it, per the method)
> Sure, I can call after Diwali. Just so I understand: you said about Rs {loss_month} a month is going
> unanswered, and Diwali is usually the busiest enquiry season. If we wait, you're OK living with that for the
> next two months? If yes, tell me a date and I'll call then. If not, the trial takes 7 days.

(Then: if they give a date, log it as the decision date, a real commitment point. If they stay vague, log
"stall, words > actions" in TEMQ and move on.)

### "Is this a robot calling me?" (calls)
> Yes, I'm PROXe, an AI. I said so at the start. This is the same way I'd answer your customers. Do you want to
> keep talking, or shall I end the call?

### "Don't call / don't message me again"
> Understood, I've removed your number. Sorry for the disturbance.
(Log do-not-contact on all channels the same day.)

---

## 7. Tracking spec: one row per touch

Lands in ARC `outreach_activity` (append-only, per touch) linked to `outreach_targets` (one per account), then
promotes to PROXe `all_leads` on interest (existing mirror to `proxe_outbound_*`, commit 7d44bee7) and to the TEMQ
grid `proxe_commitment_matrix`.

### Per account (`outreach_targets`, kind = business)
| Field | Where | Notes |
|---|---|---|
| name, org, segment, city, phone, email, linkedin, website | existing columns | From Apollo |
| source | existing | "apollo-pilot-30" |
| why_them | existing | Why this is a bigger player (enquiry volume signal: ads running, branches, reviews) |
| status | existing | identified > sent > replied > meeting > won / lost / no_reply |
| next_at | existing | Next touch date from the sequence table |
| qualified_at, qualification_note | existing | Set when enquiries a day >= 15 is confirmed |
| proxe_lead_id, promoted_at | existing | Set when promoted to PROXe |
| dnd_checked, do_not_contact | NEW (or in notes until added) | TRAI scrub done; opted out |

### Per touch (`outreach_activity`)
| Field | Value |
|---|---|
| channel | call / whatsapp / linkedin / email |
| outcome | call: no_answer, connected_no, connected_yes, callback, dnc. whatsapp/linkedin/email: sent, delivered, read, replied, accepted, bounced, opted_out |
| worker | "proxe-voice", "z-whatsapp", "z-linkedin", "gmail" |
| external_id | call id / WhatsApp message id / Gmail message id / "li-{date}-{target}" |
| occurred_at | timestamp |
| summary | One line, no private details. Template used (W1 to W4, L1, L2, E1, UK-1..4) |
| evidence_url | call recording / thread link |
| next_at | next scheduled touch |

### TEMQ fields captured from replies and calls (feed `proxe_commitment_matrix`)
| Field | What to log |
|---|---|
| enq_day (words) | Enquiries a day they SAY |
| pain_rs_month | Rs lost a month from the calculator, their numbers |
| VPP level | value / problem / painkiller (painkiller only when they state the pain in Rs themselves) |
| TEMQ words (1-5) | T, E, M, Q from what they say |
| TEMQ actions (1-5) | T, E, M, Q from what they do: took the call, opened calculator, gave numbers, booked slot, entered card |
| gap | words minus actions: the read |
| commitment_point | type (card check / pilot fee / decision date / booked slot) + date + kept yes/no |
| stall_named | yes/no, with the date they gave |
| aligned | automatic: actions >= words and a commitment point recorded |

Rule: no account changes stage without a recorded commitment point.

---

## Decisions waiting on Z
1. WhatsApp to numbers that never opted in (W2, W3, W4 to Apollo numbers): allowed from the outbound number as
   Marketing templates, or call + LinkedIn only until they reply?
2. Calculator link: it is private to Z today. Make it shareable for prospects, or move it to goproxe.com?
3. The [7-DAY] offer, booking link, GBP price, and who signs the UK emails (Z or BVCL).
