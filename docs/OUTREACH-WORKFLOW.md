# ARC outreach and PROXe qualification

## Ownership

ARC owns cold prospects, source lists, citations, test calls and their history.
PROXe owns inbound contacts and explicitly qualified outbound contacts.
An answered call, a submitted citation, an agent's promise to send WhatsApp, or
an email draft is not qualification and is not proof of delivery.

ARC's lead panel has Overview, Activity and Edit details. Recording review shows
the actual BDR agent, recipient, time, duration, audio and speaker-labelled transcript.
The four workspace areas are Outreach lists, Calls, Citations and Test activity.

PROXe's Contacts screen defaults to Inbound. Qualified outbound is separate.
Needs review contains historical outbound/stub records without verified ARC qualification.
These are preserved, not deleted. Existing inbound provenance survives later ARC contact.

## Deployment status and order

These changes are prepared locally, not deployed. The call-review HTML exported
on 8 September 2026 contains the retrieved 45-call snapshot and 30 recordings.
The snapshot is not a live call monitor.

1. Apply supabase/migrations/20260908000000_outreach_activity.sql to ARC.
   It adds activity, explicit qualification, call idempotency, and atomic 24-hour
   dial reservations. It also restricts direct anonymous/authenticated database
   access to outreach tables: UI reads/writes already use authenticated APIs.
   Workers using service-role credentials continue to work; browser/anon-key
   writers must move to the machine API.
2. Deploy ARC's API and UI changes.
3. Deploy the isolated goproxe.com branch codex/arc-qualification.
   Its authenticated history bridge keeps the ElevenLabs secret in BDR.
   Its dialer reserves in ARC before placing a call and no longer creates PROXe stubs.
   Cold/test post-call webhooks return after ARC ingest.
4. Deploy only the PROXe brand from branch codex/arc-outreach-qualification,
   following that repository's deployment process. It rejects unqualified
   outbound ingestion and WhatsApp promotion, and verifies ARC before handoff.
5. Verify signed-out history, transcript and audio requests return 401.
   Verify an unqualified handoff returns 409 without inserting a contact.
   Use dry-run readiness checks before any user-authorized send or test call.

ARC already uses PROXE_DIAL_BASE/PROXE_DIAL_KEY and
PROXE_INTENT_BASE/PROXE_INBOUND_API_KEY. Do not duplicate the ElevenLabs key.
The BDR history bridge accepts its existing DIAL_API_KEY/BDR_DIAL_KEY.
PROXe verifies qualification against ARC_BASE_URL (defaults to arc.bconclub.com)
using its existing INBOUND_API_KEY. This must match ARC's existing
PROXE_INBOUND_API_KEY. No automatic fallback if verification fails.

## Bot contract

Read: GET /api/agent/outreach
Write: POST /api/agent/outreach
Headers:
  Authorization: Bearer <ARC_INGEST_SECRET>
  X-Agent-Name: <unique-worker-name>

The read response contains targets, activity, and reportingReady.
Do not interpret reportingReady:false or a failed read as an empty work queue.
Source/batch is target.source. Keep test targets out of prospect batches.
Do not use sales status to infer a completed call or a live citation.

Example event:

    {
      "target_id": "<existing-target-uuid>",
      "external_id": "citation:g2:submission:2026-09-08:001",
      "channel": "citation",
      "outcome": "submitted",
      "occurred_at": "2026-09-08T10:00:00Z",
      "summary": "Submission sent. Awaiting directory review.",
      "evidence_url": "https://example.com/submission-receipt",
      "next_at": "2026-09-15T04:30:00Z"
    }

Events are append-only. Retry the same external_id with the identical payload:
the server returns the existing event, not a duplicate. A changed outcome is a
NEW event ID. Reusing an ID with different content returns 409.
Event time determines ordering, so delayed reports cannot overwrite newer work.
Give each batch a single operator; this event API is reporting, not a job-claim
or permission to place calls or send messages. Use the existing job/heartbeat
endpoints for worker scheduling and liveness.

Call outcomes: queued, ringing, connected, no_answer, callback, interested,
not_interested, wrong_number, failed, cancelled.
Citation outcomes: pending, in_progress, submitted, live, rejected, blocked.
Email: pending, drafted, sent, replied, failed.
WhatsApp/LinkedIn: pending, sent, replied, failed.

No-answer/callback remain pending follow-up. Submitted citations remain in
progress. Only live plus a public evidence URL counts as a completed citation.
Historical sent/won citation stages without evidence show "needs verification".

BDR's webhook continues to POST /api/agent/outreach-call and now includes
conversation_id. Repeated conversation IDs do not create duplicate call messages.
Ambiguous phone matches require target_id.
Recordings are read directly through the authenticated BDR bridge; never paste a
private ElevenLabs API URL into the UI as though it were a playable recording.

## Qualification and handoff

In a real business target, expand Qualify for PROXe. Record the business need and
agreed next step, save qualification, then choose Hand off to PROXe.
Tests, investors, grants and citations cannot be promoted as business prospects.
The handoff itself does not send messages or start a sequence.
PROXe rechecks ARC server-side instead of trusting a worker-supplied qualified flag.
WhatsApp requires a qualified, handed-off contact plus a valid service window or
an approved template. A live dry run on 8 September returned template required
for the test number; no message was sent.

## Verification

- ARC production build and type check passed.
- BDR type check passed.
- 28 focused checks passed. Run: node scripts/outreach-checks.cjs C:/PROXe-wt/arc-outreach-qualification
- PROXe baseline comparison: 397 existing type diagnostics, 397 after changes,
  no new diagnostics.
- Desktop/mobile browser review used the retrieved call snapshot as read-only
  test data. No page errors; mobile document width stayed within the viewport.
- Local PostgreSQL migration checks passed: repeat application, preserved rows, competing reservations, expiry, anonymous-access restrictions and event uniqueness.
- Real local ARC-to-BDR integration returned 45 calls, 30 recordings and zero unknown recipients. Transcript/audio retrieval passed. Browser playback decoded successfully with a finite duration; byte-range seeking checks passed.
- Applying the migration to the live database and the production rollout remain pending.

## 9 September call controls

BDR outbound prompts now end silent/IVR/goodbye calls using end_call, with a 12-second silence timeout. Voice, model and opener are unchanged; website callback agents are untouched. Outbound WhatsApp tools are detached; server verifies conversation ownership before any PROXe send. No contacts are promoted automatically.

ARC reservation now requires a matching target and refuses closed/ambiguous prospects. Dry runs check migration and cooldown without reserving. Callback preferences are logged with call time and remain pending review. Calls show evidence-based outcomes rather than treating provider completion as qualification.

Current main filters retained: All Prospects, Today's 10 and business-only Dialed / Outreached. Local modifications in the original ARC checkout remain untouched.

Validation: both production builds passed; 28 qualification checks, 16 BDR isolation checks, seven ARC reservation checks; provider text simulations of silence, IVR, callback and information request. No real call placed. Migration 20260908000000 remains pending user execution; new outbound calls fail closed until ARC is ready.

## Per-call cost reporting

The Calls table and call review expose Vobiz telephony, ElevenLabs USD cost, ElevenLabs credits, and LLM token counts. This includes historical records when providers return billing metadata. Unknown is not zero. Charges may arrive after the call finishes; refresh retrieves provider data again.

- ElevenLabs monetary total uses `metadata.cost_fiat`. Missing provider totals remain unavailable even when some component prices are present. Credits use `metadata.cost` and are never treated as dollars or tokens. The model price is part of the ElevenLabs amount, never added a second time.
- Tokens aggregate `charging.llm_usage.initiated_generation.model_usage` input, output_total, input_cache_read and input_cache_write. Initiated usage includes interrupted generation. Do not add irreversible_generation or detailed_model_usage because they overlap. Missing categories leave the token total unavailable.
- BDR's authenticated history bridge allows only the billing fields needed by ARC. Provider secrets remain server-side. Existing agent allowlisting and ARC session verification apply.
- Configure `VOBIZ_AUTH_ID` and `VOBIZ_AUTH_TOKEN` in the BDR service's secret environment, not client variables. No Vobiz credentials were found in the checked local ARC/BDR configuration. No credentials have been copied from another brand.
- Vobiz lookup uses its account CDR API filtered by the provider call's SIP ID. Accept exactly one outbound record with matching SIP ID and destination, use `total_cost`, `currency` and `billsec`. Missing/ambiguous matches remain unavailable. Multiple billed legs require reconciliation before reporting a charge. No phone/time approximation is labelled as actual billing.
- Provider currencies remain separate. No exchange rate, subscription allocation, or combined cross-currency total is invented. Vobiz live billing verification remains pending credentials and exact call-ID availability.

Sources: https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get and the official https://github.com/vobiz-ai/Vobiz-Python-SDK CDR client/schema.

Checks: `node scripts/outreach-cost-checks.cjs` covers dollar/credit separation, duplicate usage, unknown and zero costs, billing bridge passthrough, and Vobiz matching. Both apps type-check. Desktop and phone cost list/modal rendering verified using saved provider data; no new call placed.
