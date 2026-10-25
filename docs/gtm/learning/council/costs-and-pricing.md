# Unit costs and pricing (measured 2026-10-18)

Sources: Gmail invoices (Jul to Oct 2026), the BCON PROXe Supabase token logs, the ElevenLabs and Vobiz dashboards, the
PROXe repo, and a public price check of voice providers on 2026-10-18. Re-measure before quoting anything big.

## What we spend (core stack, real invoices)
Jul about Rs 18.5k, Aug Rs 12.1k, Sep Rs 21.9k, Oct to the 18th Rs 10k (Anthropic API, Supabase, Vercel, WhatsApp,
ElevenLabs). Vobiz has no receipts in Gmail.

## AI cost per reply (measured)
- PROXe brand: about Rs 0.29 per AI reply (about 3 replies per lead, about Rs 1.2 per lead).
- BCON brand: about Rs 1.6 per reply, because prompt caching was not working (cache written every call, never read).
- Fixing caching is the biggest margin lever on text.

## Voice
- ElevenLabs Agents (current engine): Rs 7.04/min platform on every plan (burst Rs 14.08), LLM and phone line extra.
  Plans by concurrent calls: Creator 10, Pro 20, Scale 30, Business 40.
- Vobiz phone line: about Rs 0.75/min last week; account limit 3 concurrent calls, 1 call per second (purchasable).
- Real pickup rate: 55% (Vobiz). Connected calls mostly 25s to 1m40s.
- Market check: Sarvam agents Rs 3.00-3.50/min + phone line (Kannada and 10 other Indian languages; billed per started
  minute); Bolna Rs 3.5-5; own stack about Rs 2-2.5; ElevenLabs/Vapi/Retell Rs 6.5-12. Twilio India numbers cannot call
  Indian numbers.

## Infra per brand
Each paying brand gets its own Supabase project and Vercel project: about Rs 1,500-2,000/month now, Rs 3-5k for a heavy
brand (estimate from invoices).

## Billing system status (repo, 2026-10-18)
The credits engine and ledger exist but are not wired. Nothing caps leads, replies or minutes for paying customers.
The PROXe agent prompts still quote Rs 9,999 = 500 leads + 100 minutes, while gtm_brief says 1,000 leads + 250 minutes.

## Pricing card (#8)
Rs 9,999/month platform + Rs 6 per lead + Rs 10 per call minute, plus GST; fixed monthly commitment; Meta fees on the
client's own account; Rs 50k setup; 3 months.

| Leads/day | Monthly bill | Per lead | Our cost (ElevenLabs / Sarvam voice) |
|---|---|---|---|
| 100 | Rs 53k | Rs 17.6 | Rs 31k / 23k |
| 200 | Rs 96k | Rs 15.9 | Rs 58k / 42k |
| 300 | Rs 1.38L | Rs 15.4 | Rs 84k / 60k |
| 400 | Rs 1.81L | Rs 15.1 | Rs 1.11L / 78k |
| 500 | Rs 2.24L | Rs 14.9 | Rs 1.37L / 97k |

Assumes every lead is called, 55% pickup, about 1.5 min per connected call, about 8 AI replies per lead. Margin about
39% on ElevenLabs voice, about 57% on Sarvam voice.

## Before signing a high-volume client
Anthropic credits on auto-reload (API was cut off 3 times since July), card payments fixed across providers, prompt
caching fixed, call concurrency raised to 10+.
