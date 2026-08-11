// ARC version tracking — KEEP IN SYNC WITH package.json "version".
// Sidebar, changelog and release tags all read from VERSION below.
//
// Scheme: the PATCH number counts up 1 → 100 before the minor moves.
// It is NOT semver — patch is a running build counter, so 0.0.47 is normal and
// 0.0.100 is the last patch in the series before the minor rolls.
//
//   0.0.1 · 0.0.2 · … · 0.0.99 · 0.0.100 → 0.1.0 → 0.1.1 · …
//
// Every shipped batch bumps the patch by one, regardless of size. Do not jump
// the number to match a design mockup.

export const VERSION = "0.0.9";

export const CHANGELOG = [
  {
    version: "0.0.9",
    date: "2026-08-12",
    notes: "Invoices can be read from a PDF or a photo — including scans with no text layer, which is why four amounts were blank. Logo pull now searches a repo properly and finds marks in nested folders. Real ARC logo artwork in the sidebar with the version beside it. Brands grouped Live / Proposed / Completed.",
  },
  {
    version: "0.0.8",
    date: "2026-08-12",
    notes: "Brands list stripped to live vs completed. Logos resolved server-side from a linked repo or a verified favicon instead of guessed at render time. Repos can be linked from the brand page. Fixed the money donut counting overdue twice.",
  },
  {
    version: "0.0.7",
    date: "2026-08-11",
    notes: "Brands classified as client / agency / partner / prospect / own. Now Media and Proago separated out as their own entities instead of aliases. Kosh Studios linked to Now Media, whose contacts now surface on the client profile.",
  },
  {
    version: "0.0.6",
    date: "2026-08-11",
    notes: "Repointed at the rqpj database and made brands the client register there: real clients inserted, aliases backfilled so name variants resolve, people linked. All client names now match a brand.",
  },
  {
    version: "0.0.5",
    date: "2026-08-11",
    notes: "Brand profiles gained a Contacts block, linked through people.brand_id with an org-text fallback. Fixed brand rows disagreeing with their own totals by matching aliases everywhere.",
  },
  {
    version: "0.0.4",
    date: "2026-08-11",
    notes: "Single-viewport command centre. Operations page with delivery timeline. Brands as client-register profiles with GST block and repo activity. Admin connector panel. ARC brand mark, favicon and lime accent. Mobile nav drawer.",
  },
  {
    version: "0.0.3", 
    date: "2026-04-05", 
    notes: "Fixed production blank screen. Removed Anthropic SDK from client bundle. Fixed Supabase type errors. Build passing." 
  },
  { 
    version: "0.0.2", 
    date: "2026-04-05", 
    notes: "Added Kimi K2 model support. Fixed client-side hydration issues." 
  },
  { 
    version: "0.0.1", 
    date: "2026-04-05", 
    notes: "Initial build. Feed, Write, Schedule, Voice, Sources. Persistent context system. YouTube-style feed tiles." 
  }
];

export function getVersion(): string {
  return VERSION;
}

export function getChangelog() {
  return CHANGELOG;
}
