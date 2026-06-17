export const BCON = {
  positioning:
    "AI-native marketing. We test the newest creative AI tools and techniques, then show our audience exactly how to use them.",
  winning_format: "trend + interactive hook + how-to tutorial (15-30s)",
  voice:
    "Builder, hands-on, no fluff. Proof over claims. First person, short punchy sentences. Conversational. Every post ends with an action CTA (DM me, Comment LEADS, etc).",
  video_len_s: [15, 30] as [number, number],
  platforms: ["instagram", "youtube", "tiktok", "linkedin"] as const,

  fit_signals: [
    "new AI tool, model, or feature just dropped",
    "creative tech: image gen, video gen, audio gen, code gen",
    "something testable and demoable in under 30 seconds",
    "emerging trend we can be early on (< 72h old)",
    "specific how-to angle available (not just news)",
    "India-relevant or globally applicable to solo founders / SMBs",
  ],

  anti_signals: [
    "pure news with nothing to demo or teach",
    "no visual payoff — can't be shown on screen",
    "off-domain: crypto, hardware, sports, politics",
    "requires enterprise budget or closed beta to test",
    "already oversaturated (every creator posted it)",
  ],

  icp:
    "Solo founders, coaching academies, clinics (dental/skin/physio), real estate agents, tutoring centers in India. 5–15L/month revenue. They lose leads due to slow WhatsApp replies and lack of proper follow-up systems.",

  hook_patterns: [
    "This [tool] just changed how I [task] forever.",
    "I tested [X] so you don't have to. Here's what happened.",
    "Stop doing [old way]. Use [new tool] instead.",
    "Nobody's talking about this yet. [Tool] can [outcome].",
    "POV: you just saved 3 hours using [tool].",
  ],
} as const;
