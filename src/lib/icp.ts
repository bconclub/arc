// PROXe ICP and the keyword bank that scores the market against it.
//
// Importable from client and server. No I/O. The durable rows live in
// icp_keywords; this file is the seed and the ranking rules so a listen run
// and the RSS scorer cannot disagree about what "fits".

export const PROXE_ICP = {
  product: "PROXe",
  who: "solo founders, coaching academies, clinics, real estate offices and tutoring centres in India",
  leak: "leads dying on WhatsApp, Instagram, the website and the phone because nobody answers fast, especially after hours",
  job: "every enquiry answered instantly, remembered, followed up, booked",
  not: "enterprise chatbots, bulk WhatsApp blasts, generic CRMs",
} as const;

export type KeywordCluster = "pain" | "job" | "category" | "competitor" | "geo";
export type KeywordVertical = "clinic" | "coaching" | "real_estate" | "tutoring" | "founder" | "all";
export type KeywordIntent = "informational" | "commercial" | "transactional";
export type KeywordSource = "seed" | "harvest" | "manual";
export type KeywordStatus = "use" | "watch" | "drop";

export type IcpKeyword = {
  phrase: string;
  cluster: KeywordCluster;
  vertical: KeywordVertical;
  intent: KeywordIntent;
  source: KeywordSource;
  status: KeywordStatus;
};

/** Tokens that mark a title as in-ICP. Used by harvest and RSS boost. */
export const ICP_ANCHORS = [
  "whatsapp",
  "enquiry",
  "inquiry",
  "follow-up",
  "follow up",
  "missed call",
  "after hours",
  "justdial",
  "india mart",
  "indiamart",
  "clinic",
  "coaching",
  "real estate",
  "realty",
  "tutoring",
  "tuition",
  "admission",
  "appointment",
  "site visit",
  "instagram dm",
  "lead response",
  "small business",
  "smb",
];

/**
 * High-fidelity phrases, not the old one-word list (AI, leads, India).
 * Written the way a buyer would type them into Google or say them to a peer.
 */
export const SEED_KEYWORDS: IcpKeyword[] = [
  // pain: the leak, in their words
  { phrase: "missed whatsapp enquiry after hours", cluster: "pain", vertical: "all", intent: "informational", source: "seed", status: "use" },
  { phrase: "clinic appointment whatsapp not answered", cluster: "pain", vertical: "clinic", intent: "informational", source: "seed", status: "use" },
  { phrase: "coaching academy admission enquiry delay", cluster: "pain", vertical: "coaching", intent: "informational", source: "seed", status: "use" },
  { phrase: "real estate site visit no show follow up", cluster: "pain", vertical: "real_estate", intent: "informational", source: "seed", status: "use" },
  { phrase: "tutoring demo class no show whatsapp", cluster: "pain", vertical: "tutoring", intent: "informational", source: "seed", status: "use" },
  { phrase: "justdial leads not converting", cluster: "pain", vertical: "all", intent: "informational", source: "seed", status: "use" },
  { phrase: "instagram dm leads going cold", cluster: "pain", vertical: "all", intent: "informational", source: "seed", status: "use" },
  { phrase: "website chat no reply small business", cluster: "pain", vertical: "founder", intent: "informational", source: "seed", status: "use" },
  { phrase: "lead response time after 9pm", cluster: "pain", vertical: "all", intent: "informational", source: "seed", status: "use" },
  { phrase: "missed call follow up india smb", cluster: "pain", vertical: "founder", intent: "informational", source: "seed", status: "use" },
  { phrase: "whatsapp not answering patient enquiry", cluster: "pain", vertical: "clinic", intent: "informational", source: "seed", status: "use" },
  { phrase: "coaching institute whatsapp bot failed", cluster: "pain", vertical: "coaching", intent: "informational", source: "seed", status: "use" },

  // job: what they are trying to get done
  { phrase: "whatsapp crm for clinics india", cluster: "job", vertical: "clinic", intent: "commercial", source: "seed", status: "use" },
  { phrase: "ai receptionist for coaching institute", cluster: "job", vertical: "coaching", intent: "commercial", source: "seed", status: "use" },
  { phrase: "real estate lead follow up automation", cluster: "job", vertical: "real_estate", intent: "commercial", source: "seed", status: "use" },
  { phrase: "appointment booking whatsapp tutoring", cluster: "job", vertical: "tutoring", intent: "commercial", source: "seed", status: "use" },
  { phrase: "never miss a whatsapp lead", cluster: "job", vertical: "all", intent: "commercial", source: "seed", status: "use" },
  { phrase: "after hours lead response whatsapp", cluster: "job", vertical: "all", intent: "commercial", source: "seed", status: "use" },
  { phrase: "multi channel lead inbox india", cluster: "job", vertical: "founder", intent: "commercial", source: "seed", status: "use" },
  { phrase: "whatsapp business api for clinics", cluster: "job", vertical: "clinic", intent: "commercial", source: "seed", status: "use" },
  { phrase: "coaching academy admission chatbot", cluster: "job", vertical: "coaching", intent: "commercial", source: "seed", status: "use" },
  { phrase: "property enquiry whatsapp auto reply", cluster: "job", vertical: "real_estate", intent: "transactional", source: "seed", status: "use" },

  // category: how they name the product
  { phrase: "conversational ai for smb india", cluster: "category", vertical: "founder", intent: "commercial", source: "seed", status: "use" },
  { phrase: "ai sales assistant india small business", cluster: "category", vertical: "founder", intent: "commercial", source: "seed", status: "use" },
  { phrase: "whatsapp automation for coaching academies", cluster: "category", vertical: "coaching", intent: "commercial", source: "seed", status: "use" },
  { phrase: "lead conversion software india", cluster: "category", vertical: "all", intent: "commercial", source: "seed", status: "use" },
  { phrase: "ai receptionist for clinics india", cluster: "category", vertical: "clinic", intent: "commercial", source: "seed", status: "use" },
  { phrase: "whatsapp crm small business india", cluster: "category", vertical: "founder", intent: "commercial", source: "seed", status: "use" },

  // competitor: the searches that compare tools
  { phrase: "interakt alternative india", cluster: "competitor", vertical: "all", intent: "commercial", source: "seed", status: "watch" },
  { phrase: "aisensy vs wati", cluster: "competitor", vertical: "all", intent: "informational", source: "seed", status: "watch" },
  { phrase: "wati whatsapp crm india", cluster: "competitor", vertical: "all", intent: "commercial", source: "seed", status: "watch" },
  { phrase: "doubletick whatsapp automation", cluster: "competitor", vertical: "all", intent: "commercial", source: "seed", status: "watch" },
  { phrase: "freshchat whatsapp india", cluster: "competitor", vertical: "all", intent: "commercial", source: "seed", status: "watch" },

  // geo: local discovery
  { phrase: "whatsapp crm bangalore", cluster: "geo", vertical: "founder", intent: "commercial", source: "seed", status: "use" },
  { phrase: "clinic software india whatsapp", cluster: "geo", vertical: "clinic", intent: "commercial", source: "seed", status: "use" },
  { phrase: "coaching institute crm india", cluster: "geo", vertical: "coaching", intent: "commercial", source: "seed", status: "use" },
  { phrase: "real estate crm india whatsapp", cluster: "geo", vertical: "real_estate", intent: "commercial", source: "seed", status: "use" },
];

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "at", "is", "are",
  "with", "from", "this", "that", "your", "our", "its", "as", "be", "by", "it",
]);

export function wordCount(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}

/** Longer phrases are the ones a buyer types. One-word terms are noise. */
export function specificityScore(phrase: string): number {
  const n = wordCount(phrase);
  if (n <= 1) return 0;
  return Math.min(40, (n - 1) * 10);
}

export function containsAnchor(text: string): boolean {
  const t = text.toLowerCase();
  return ICP_ANCHORS.some((a) => t.includes(a));
}

export function phraseMatches(haystack: string, phrase: string): boolean {
  return haystack.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * Listen rank, 0-100. Deterministic. Not search volume.
 * specificity (0-40) + base ICP weight (30 for seed/use, 18 for watch) +
 * market presence (0-40 from hits).
 */
export function listenRank(opts: {
  phrase: string;
  source: KeywordSource;
  status: KeywordStatus;
  hits: number;
}): number {
  const spec = specificityScore(opts.phrase);
  const base = opts.status === "drop" ? 0 : opts.source === "seed" && opts.status === "use" ? 30 : 18;
  const presence = Math.min(40, opts.hits * 8);
  return Math.max(0, Math.min(100, spec + base + presence));
}

export function harvestPhrases(texts: string[], existing: Set<string>): IcpKeyword[] {
  const counts = new Map<string, number>();
  for (const raw of texts) {
    const words = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s+-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w));
    if (words.length < 3) continue;
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const slice = words.slice(i, i + n);
        const phrase = slice.join(" ");
        if (existing.has(phrase)) continue;
        if (!containsAnchor(phrase)) continue;
        if (specificityScore(phrase) < 20) continue;
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase]) => ({
      phrase,
      cluster: "pain" as const,
      vertical: inferVertical(phrase),
      intent: "informational" as const,
      source: "harvest" as const,
      status: "watch" as const,
    }));
}

export function inferVertical(text: string): KeywordVertical {
  const t = text.toLowerCase();
  if (/\bclinic|hospital|patient|dentist|doctor\b/.test(t)) return "clinic";
  if (/\bcoach|academy|admission|institute\b/.test(t)) return "coaching";
  if (/\breal estate|realty|site visit|property|broker\b/.test(t)) return "real_estate";
  if (/\btutor|tuition|demo class\b/.test(t)) return "tutoring";
  if (/\bfounder|smb|small business\b/.test(t)) return "founder";
  return "all";
}

/** Drop-in replacement for the old generic ICP_KEYWORDS list. */
export const ICP_KEYWORDS = SEED_KEYWORDS.map((k) => k.phrase);

/** RSS / signal boost: phrase or anchor match, no random factor. */
export function icpBoost(title: string, snippet: string): number {
  const text = `${title} ${snippet}`.toLowerCase();
  let boost = 0;
  if (containsAnchor(text)) boost += 20;
  let hits = 0;
  for (const k of SEED_KEYWORDS) {
    if (k.status === "drop") continue;
    if (text.includes(k.phrase)) hits++;
  }
  boost += Math.min(40, hits * 12);
  return boost;
}
