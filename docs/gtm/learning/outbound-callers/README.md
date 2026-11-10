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
4. Agents and openers are described in [../axlrate-gtm/handoff.md](../axlrate-gtm/handoff.md) ("Outbound callers").
