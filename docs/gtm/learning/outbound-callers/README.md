# Outbound callers: the one place for changes and feedback

> **Since:** 2026-11-10 (Z: "one unified place where both of you work on the agents; feedback I give either of you goes
> here; calls happen through ARC; every change to the callers is made and recorded here")
> **Who uses it:** GOD (Z's assistant on the Mac), the GTM agent, PROXe Core, anyone touching the AI callers.

## Rules
1. **Every caller change goes here first.** Before editing an ElevenLabs agent (prompt, first line, voice, model,
   variables) or the dial flow, read this folder, then add a dated line to [changes.md](changes.md): what, why, who,
   and where the previous version is backed up.
2. **Every piece of Z's feedback on calls goes in [feedback.md](feedback.md)**, in his words, whichever agent he said
   it to. Read it before any change.
3. **Calls go through ARC.** Every dial reserves in ARC first (`/api/agent/outreach/reserve`, 24 h cooldown) and
   results land in `outreach_activity` via the post-call webhook. No dialling straight to ElevenLabs.
5. **Test before live, then measure.** Every prompt change gets one test call to Z's number (+91 97316 60933) before real calls, with the result noted in changes.md; the next day's connect % and positive % (of connected) are checked against the day before, and a change that makes things worse is rolled back (backups in GOD's outbound/agent-backup-*.json). Batch several small fixes into one change a day rather than many.
4. Agents and openers are described in [../axlrate-gtm/handoff.md](../axlrate-gtm/handoff.md) ("Outbound callers").

## Where it lives now (since 2026-11-10)
The log is a table in ARC (`outbound_notes`), not these files. People read and add on **ARC > Caller log**
(`/dashboard/outreach/callers`): Z's feedback, what the calls teach, open problems, changes made.
Agents use `/api/agent/outreach/notes` with the ARC ingest bearer and an `x-agent-name` header:
- `GET` returns every note plus a plain-text version. Read it before touching a caller.
- `POST { notes: [{ external_id, kind, body, caller?, action?, call_id?, noted_on?, resolved? }] }` with `kind` one of
  `feedback`, `learning`, `issue`, `change`. Same `external_id` updates the note instead of duplicating it.

`feedback.md` and `changes.md` were copied in on 10 Nov and are kept only as history. Write new entries to the log.
