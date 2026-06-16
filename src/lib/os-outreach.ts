// ARC OS — Outreach lane data (stubbed v1).
//
// Leads + products + plan. Endpoints/shape final; lead source swaps stub → real
// (PROXe CRM / imported lists) at the connections stage. Drafts are real (AI).

import type { Lead, Product } from "@/types/os";

// Our products — used to pitch in outreach + drafts. Editable later in UI.
export const PRODUCTS: Product[] = [
  {
    id: "proxe",
    name: "PROXe",
    tagline: "Turns every potential customer into revenue.",
    pitch:
      "Enterprise-grade conversational AI for SMBs. Listens across every channel (website, WhatsApp, Instagram, email, SMS, voice), warms leads, books calls, and never forgets a follow-up. Founder dashboard so you see everything.",
    bestFor: "SMBs losing leads to slow replies — clinics, coaching academies, real estate, tutoring.",
  },
  {
    id: "bcon",
    name: "BCON Club",
    tagline: "Learn to build with AI.",
    pitch:
      "For businesses that want to build their own AI instead of buying it. Cohort-based, hands-on, build-in-public.",
    bestFor: "Founders and teams who want to go AI-native themselves.",
  },
];

// Seed leads — mix of India + US, channels, stages. Stub until CRM wired.
export const SEED_LEADS: Lead[] = [
  { id: "l1", name: "Dr. Anita Rao", company: "SmileCraft Dental", role: "Owner", industry: "Dental clinic", region: "India", channel: "whatsapp", stage: "new", fit: 94, why: "3-clinic chain, runs Meta ads but replies to WhatsApp leads in hours. Textbook PROXe fit.", lastTouch: null, handle: "+91 98••• •••21" },
  { id: "l2", name: "Marcus Bell", company: "Bell Property Group", role: "Founder", industry: "Real estate", region: "US", channel: "email", stage: "new", fit: 88, why: "US realtor, 6 agents, leads from Zillow go cold overnight. Time-zone gap = lost deals.", lastTouch: null, handle: "marcus@bellpg.com" },
  { id: "l3", name: "Priya Menon", company: "LearnLeap Academy", role: "Director", industry: "Coaching academy", region: "India", channel: "instagram", stage: "contacted", fit: 91, why: "Top-converting ICP. DM'd 3d ago, opened, no reply. Ready for a nudge.", lastTouch: "2026-06-13", handle: "@learnleap" },
  { id: "l4", name: "Tom Hardy", company: "FlexPhysio", role: "Co-founder", industry: "Physiotherapy", region: "US", channel: "linkedin", stage: "replied", fit: 85, why: "Replied 'interested, send details'. Needs the PROXe one-pager + a call link. Hot.", lastTouch: "2026-06-15", handle: "in/tomhardy-physio" },
  { id: "l5", name: "Sana Khan", company: "BrightFuture Tutors", role: "Owner", industry: "Tutoring center", region: "India", channel: "whatsapp", stage: "new", fit: 90, why: "Inbound from a reel. Asked about pricing, never followed up. Re-engage.", lastTouch: null, handle: "+91 99••• •••07" },
  { id: "l6", name: "Jennifer Wu", company: "Glow Skin Co", role: "Founder", industry: "Skin clinic", region: "US", channel: "email", stage: "new", fit: 82, why: "Scaling US skin-clinic, books via DMs. Loses after-hours leads — PROXe voice + WhatsApp.", lastTouch: null, handle: "jen@glowskin.co" },
  { id: "l7", name: "Rahul Verma", company: "Verma Realty", role: "Founder", industry: "Real estate", region: "India", channel: "whatsapp", stage: "cold", fit: 76, why: "Went quiet 3 weeks ago after a demo. Worth one re-open with a results angle.", lastTouch: "2026-05-24", handle: "+91 90••• •••55" },
  { id: "l8", name: "David Okafor", company: "PeakForm Gym", role: "Owner", industry: "Fitness", region: "US", channel: "instagram", stage: "new", fit: 79, why: "US gym chain, lead forms but slow follow-up. Good lookalike to current wins.", lastTouch: null, handle: "@peakform" },
];

// Outreach plan blocks — the "how do we set this up" answer, per region/channel.
export interface PlanBlock {
  title: string;
  region: string;
  detail: string;
  steps: string[];
}

export const OUTREACH_PLAN: PlanBlock[] = [
  {
    title: "India — WhatsApp-first",
    region: "India",
    detail: "Fastest channel for Indian SMBs. They live on WhatsApp. Lead with a clinic/academy result, not a pitch.",
    steps: [
      "Warm leads first: re-engage the 3 who went quiet (Priya, Sana, Rahul).",
      "New leads: open with a specific result ('a dental chain like yours cut missed leads 40%').",
      "Send PROXe one-pager only after a reply. Book a 15-min demo via Calendly.",
      "Daily target: 20 WhatsApp touches, 5 follow-ups.",
    ],
  },
  {
    title: "US — Email + LinkedIn",
    region: "US",
    detail: "US SMBs respond to email + LinkedIn, not cold WhatsApp. Time-zone gap is the pain we sell against.",
    steps: [
      "Cold email: subject names the leak ('your Zillow leads go cold at 9pm'). 3-email sequence.",
      "LinkedIn: connect + a 1-line value note, no pitch in the first message.",
      "Push PROXe voice + after-hours WhatsApp as the US wedge.",
      "Daily target: 15 cold emails, 10 LinkedIn touches.",
    ],
  },
];
