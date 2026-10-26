# How the ARC GTM plan was built

> **Date:** 2026-10-23  
> **From:** Axlrate PROXe GTM session, from Z's instructions; live data in ARC gtm_brief and gtm_plans  
> **Use it:** Outbound, Council and any agent that reads or changes the ARC GTM brief and plans


The live version is always `arc_context.gtm_brief` and `gtm_plans` in ARC Supabase, readable at `GET /api/gtm/plans`.
This file explains the choices.

## Brief (set 2026-10-23)
- **Offer:** two offers, one company. BCON Club fills the funnel (own video and asset pipeline, unlimited creative
  variations, performance marketing, ads, launches, branding). PROXe stops the leak (AI customer management on every
  channel, support, WhatsApp agents, team management; Core Rs 9,999 a month). Sold as a painkiller. Builds paid in
  full upfront; minimum 3 months in writing.
- **Buyer (ICP, Axlrate 00):** owner-led Indian businesses getting 30 to 100 enquiries a DAY, running ads or a busy
  WhatsApp, owner on the call. Clusters from our own leads: clinics and hospitals, coaching and schools, real estate,
  wellness. Under about 15 a day goes to BCON Growth OS. Not a fit: job seekers, workers, single shops, farmers, DSAs.
- **Win (Axlrate 04):** aligned leads is the only KPI (TEMQ words = actions, seen as a painkiller). Leading signs, in
  order: pain in Rs on the call, commitment point, trial, first charge.
- **Motion:** causal law, quantify the pain with the calculator, painkiller positioning, TEMQ on every account,
  commitment point, slow down.
- **Rules added:** outbound talks about their pain, never the product first; no account changes stage without a
  recorded commitment point.

## Plans, in order, and why
1. **icp** ICP and Dream 100: the method puts the ICP before any list. 99 of 132 PROXe leads had no industry.
2. **pain** Pain glossary and calculator: VPP says buying is easy only at painkiller, and the pain must be in Rs.
3. **research** Positioning research (VPP): positioning is how the buyer perceives us.
4. **landing**: unchanged.
5. **outbound** Dream 100 pipeline: judged on aligned leads a week (10 aligned, 5 commitment points).
6. to 9. **content, ugc, seo, ads**: later.

## Data behind it (PROXe all_leads, 11 Oct 2026)
- PROXe: 184 leads, 52 Closed Lost, 132 accounts. BCON: 34 leads, 32 accounts.
- Follow-up sequences had sent nothing for 3 days with 100 leads In Sequence; voice auto-call last ran 5 Oct.
- Junk is recorded only in free-text closed_reason; disqualification_reason was null everywhere.

## Commitment Matrix (PROXe)
The TEMQ grid lives in PROXe (`proxe_commitment_matrix`, built 9 Oct). Planned upgrade, waiting on Z: Industry, VPP
level, Rs pain a month, commitment point + date, Aligned (automatic), Not-ICP flag, headline "aligned leads this week".

## Pending Z
- Council #14a / #15 (sprint to 15 Nov, BVCL partner, close-out sweep, 7-day offer): not yet written into the brief.
- Scale card (100 to 500 leads a day): not yet in the offer.
- BCON's own ICP: not defined yet.
