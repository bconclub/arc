// ARC version tracking — KEEP IN SYNC WITH package.json "version".
// Sidebar, changelog and release tags all read from VERSION below.
// Convention:
// - Patch (0.0.x): bug fixes, UI tweaks
// - Minor (0.x.0): new feature shipped  
// - Major (x.0.0): full system change

export const VERSION = "2.1.0";

export const CHANGELOG = [
  {
    version: "2.1.0",
    date: "2026-08-11",
    notes: "Mission-control dashboard: severity donut, operations health graph, receivables ageing, brand health scores, proposal funnel, GitHub activity. Brands and services became first-class tables.",
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
