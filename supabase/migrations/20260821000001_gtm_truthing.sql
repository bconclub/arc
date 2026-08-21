-- GTM board truthing, 2026-08-21. Run AFTER 20260725000000 + 20260727000000.
-- Sets honest statuses + stand notes so the board reflects reality instead of
-- 0%. Idempotent: plain updates keyed on slug. Item names must match the
-- GTM_SCAFFOLD constant in src/app/dashboard/gtm/page.tsx exactly.

update public.gtm_areas set status = 'in_progress',
  stand = 'ICP locked: India SMBs losing leads to slow WhatsApp replies. Segments: coaching academies, clinics, real estate, tutoring centers, solo founders. Personas and TAM math still owed.',
  items = '[{"name":"Market Definition","status":"defined"},{"name":"ICP Development","status":"defined"},{"name":"Buyer Personas","status":"in_progress"},{"name":"Jobs To Be Done","status":"in_progress"},{"name":"TAM / SAM / SOM","status":"not_started"}]'::jsonb
  where slug = 'foundation';

update public.gtm_areas set status = 'in_progress',
  stand = 'Punchline locked: PROXe turns every potential customer into revenue. Listens across every channel. Never forgets. Always improving. Category framing (AI-native lead response vs chatbot) still to be written down.',
  items = '[{"name":"Value Proposition","status":"defined"},{"name":"Differentiation","status":"in_progress"},{"name":"Category Design","status":"not_started"},{"name":"Competitive Positioning","status":"not_started"},{"name":"Positioning Statement","status":"in_progress"}]'::jsonb
  where slug = 'positioning';

update public.gtm_areas set status = 'in_progress',
  stand = 'Voice locked in arc_context: journal entries not marketing copy, lowercase, no em dashes. Outbound copy rules locked (no insider language, one ask). Objection handling and message testing not started.',
  items = '[{"name":"Core Narrative","status":"defined"},{"name":"Messaging Framework","status":"in_progress"},{"name":"Taglines","status":"in_progress"},{"name":"Objection Handling","status":"not_started"},{"name":"Message Testing","status":"not_started"}]'::jsonb
  where slug = 'messaging';

update public.gtm_areas set status = 'defined',
  stand = 'PROXe Core Rs 24,999/mo. Founding members Rs 9,999 locked for life, first 20 only. Every channel, 500 leads, 2 team seats. Seat addon Rs 999. Pricing page live on goproxe.com. Post-founding conversion story is the open question for the 100-user leg.',
  items = '[{"name":"Pricing Research","status":"in_progress"},{"name":"Packaging Tiers","status":"defined"},{"name":"Pricing Metrics","status":"in_progress"},{"name":"Discount Policy","status":"defined"},{"name":"Pricing Page","status":"defined"}]'::jsonb
  where slug = 'pricing';

update public.gtm_areas set status = 'in_progress',
  stand = 'Stack for 20-by-Oct: outbound 10/day founder emails (ARC Outreach wing), WhatsApp reactivation of dropped ad leads, LinkedIn content, AEO citations (compounding, for the 100 leg), referrals from founding customers. Partnerships untouched.',
  items = '[{"name":"Channel Strategy","status":"defined"},{"name":"Inbound","status":"in_progress"},{"name":"Outbound","status":"in_progress"},{"name":"Partnerships","status":"not_started"},{"name":"Channel Testing","status":"in_progress"}]'::jsonb
  where slug = 'channels';

update public.gtm_areas set status = 'in_progress',
  stand = 'Founder-led sales: outreach reply or ad lead goes to a demo with Z, close on the founding offer. Self-serve deploy flow exists on goproxe.com. No written playbook or demo script yet, it lives in Z''s head.',
  items = '[{"name":"Self Serve","status":"in_progress"},{"name":"Sales Led","status":"defined"},{"name":"Product Led","status":"not_started"},{"name":"Sales Playbook","status":"not_started"},{"name":"Demo Scripts","status":"not_started"}]'::jsonb
  where slug = 'sales_motion';

update public.gtm_areas set status = 'in_progress',
  stand = 'ARC write/schedule wings run the content engine. Pillars: Pain Points, Marketing Tips, Build Journey, Client Results. 16 industry pages live on goproxe.com. Case studies owed once founding customers show results.',
  items = '[{"name":"Content Strategy","status":"defined"},{"name":"SEO Content","status":"in_progress"},{"name":"Case Studies","status":"not_started"},{"name":"Lead Magnets","status":"not_started"},{"name":"Sales Enablement","status":"not_started"}]'::jsonb
  where slug = 'content_engine';

update public.gtm_areas set status = 'in_progress',
  stand = 'The founding-20 IS the launch tier: scarcity engine, Rs 9,999 locked. Product Hunt launch sits in the citations checklist. No press yet, YourStory/Inc42 pitch seeded in Outreach.',
  items = '[{"name":"Launch Tiers","status":"defined"},{"name":"Launch Timeline","status":"in_progress"},{"name":"Press & PR","status":"not_started"},{"name":"Launch Assets","status":"in_progress"},{"name":"Internal Alignment","status":"defined"}]'::jsonb
  where slug = 'launch_plan';

update public.gtm_areas set status = 'in_progress',
  stand = 'Meta ads live and producing leads. Email outreach starts now via ARC Outreach wing, 10/day personalized, drafts into Gmail. Webinars proven on Windchasers, not yet run for PROXe. ABM is the outreach motion at its core.',
  items = '[{"name":"Paid Ads","status":"in_progress"},{"name":"Email Campaigns","status":"in_progress"},{"name":"Webinars","status":"not_started"},{"name":"Events","status":"not_started"},{"name":"Social Selling","status":"in_progress"},{"name":"ABM Campaigns","status":"in_progress"}]'::jsonb
  where slug = 'demand_generation';

update public.gtm_areas set status = 'in_progress',
  stand = 'PROXe''s own dashboard is the CRM, leads flow from site/WhatsApp/ads into all_leads. Outreach pipeline tracks outbound separately in ARC. Scoring and a written qualification framework not started (queue: 2 capture fields before booking).',
  items = '[{"name":"Lead Scoring","status":"not_started"},{"name":"Lead Routing","status":"defined"},{"name":"Qualification Framework","status":"in_progress"},{"name":"CRM Setup","status":"defined"},{"name":"Pipeline Reviews","status":"not_started"}]'::jsonb
  where slug = 'pipeline';

update public.gtm_areas set status = 'in_progress',
  stand = 'Dodo checkout live, first paying customer active. Close motion is the founder demo plus founding offer. Proposals/negotiation templates not needed at this price point yet.',
  items = '[{"name":"Trial Optimization","status":"not_started"},{"name":"Sales Process","status":"in_progress"},{"name":"Proposal Templates","status":"not_started"},{"name":"Negotiation","status":"not_started"},{"name":"Closing Playbook","status":"in_progress"}]'::jsonb
  where slug = 'conversion';

update public.gtm_areas set status = 'in_progress',
  stand = 'Onboarding is hands-on founder work per brand. Referral ask at onboarding is part of the 20-user path. Milestones/QBRs premature below 20 customers.',
  items = '[{"name":"Onboarding Flow","status":"in_progress"},{"name":"Success Milestones","status":"not_started"},{"name":"QBRs","status":"not_started"},{"name":"Renewal Strategy","status":"not_started"},{"name":"Advocacy Program","status":"in_progress"}]'::jsonb
  where slug = 'customer_success';

update public.gtm_areas set status = 'in_progress',
  stand = 'This board plus the Outreach pipeline are the GTM dashboard. Weekly numbers that matter now: sends, replies, demos booked, closes. CAC/LTV math starts once ad spend and closes are both real.',
  items = '[{"name":"CAC & LTV","status":"not_started"},{"name":"Funnel Metrics","status":"in_progress"},{"name":"Attribution","status":"in_progress"},{"name":"GTM Dashboard","status":"in_progress"},{"name":"Win Loss Analysis","status":"not_started"}]'::jsonb
  where slug = 'metrics';

update public.gtm_areas set status = 'in_progress',
  stand = 'Seat billing groundwork done (Rs 999 addon, flags). Everything else premature pre-20 users.',
  items = '[{"name":"Upsell Plays","status":"not_started"},{"name":"Cross Sell","status":"not_started"},{"name":"Seat Expansion","status":"in_progress"},{"name":"Usage Expansion","status":"not_started"},{"name":"Enterprise Motion","status":"not_started"}]'::jsonb
  where slug = 'expansion_revenue';
