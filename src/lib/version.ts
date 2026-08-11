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

export const VERSION = "0.0.6";

export const CHANGELOG = [
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
