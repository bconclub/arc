// ARC version tracking. KEEP IN SYNC WITH package.json "version".
// Sidebar, changelog and release tags all read from VERSION below.
//
// Scheme: the PATCH number counts up 1 → 100 before the minor moves.
// It is NOT semver, patch is a running build counter, so 0.0.47 is normal and
// 0.0.100 is the last patch in the series before the minor rolls.
//
//   0.0.1 · 0.0.2 · … · 0.0.99 · 0.0.100 → 0.1.0 → 0.1.1 · …
//
// Every shipped batch bumps the patch by one, regardless of size. Do not jump
// the number to match a design mockup.

export const VERSION = "0.0.20";

export const CHANGELOG = [
  {
    version: "0.0.20",
    date: "2026-08-12",
    notes: "Radar rows gain one-click done and not-important. Brand names can be renamed in place without orphaning their invoices. Receivables donut uses the green accent, and the invoice list is wider so due dates stop wrapping. Gmail attachment reading is built and waiting on credentials.",
  },
  {
    version: "0.0.19",
    date: "2026-08-12",
    notes: "Meta Ads and Google Analytics connectors built and registered, reporting not-connected until credentials are added. Credential files are now gitignored before any key can be downloaded.",
  },
  {
    version: "0.0.18",
    date: "2026-08-12",
    notes: "Em dashes removed from the entire codebase, not just the visible copy: comments, changelog, migrations and the value placeholder that meant no data.",
  },
  {
    version: "0.0.17",
    date: "2026-08-12",
    notes: "Radar is now ranked by severity with a priority score, showing only the top six. Resolved signals drop off it entirely instead of lingering.",
  },
  {
    version: "0.0.16",
    date: "2026-08-12",
    notes: "New Revenue page: billed history by Indian financial year and by client, off the imported GST invoices. Money under a lakh now reads as 70k rather than 70,000, and receivables use the brand lime with red kept for overdue only.",
  },
  {
    version: "0.0.15",
    date: "2026-08-12",
    notes: "Brand logos now appear wherever a brand does, not just on the Brands page. Radar signals open up so you can record what was done and mark them solved. Invoices can be reassigned to any brand. Fixed the active nav item being invisible in light theme.",
  },
  {
    version: "0.0.14",
    date: "2026-08-12",
    notes: "47 GST invoices imported with their clients created and GST numbers filled in. A parked project no longer counts as work in flight, which is why ISIVIS read as having a project open when nothing had started.",
  },
  {
    version: "0.0.13",
    date: "2026-08-12",
    notes: "Dashboard rebuilt to the reference layout: greeting, four stat cards, radar and receivables side by side, a rail with focus tasks and activity, live work as cards and the pipeline funnel. Backup export and restore moved into Settings. Timeline no longer claims a project has no date when it only lacks an end date. Removed a public unauthenticated cron endpoint that wrote to the database.",
  },
  {
    version: "0.0.12",
    date: "2026-08-12",
    notes: "Top header and the sprite are gone, so pages own the full height and the theme toggle moved into the sidebar. Every page now shares one padding scale instead of three, which is why some screens sat flush against the sidebar. Transparent logos get a backdrop chosen from their own artwork so they stay visible in either theme.",
  },
  {
    version: "0.0.11",
    date: "2026-08-12",
    notes: "Money is now an Invoices screen: overdue / due-soon / outstanding / collected across the top, status tabs, working client and month filters, and a list beside a detail panel. Upload an invoice PDF or photo and it reads the figures off the page, nothing is saved until you confirm what it read.",
  },
  {
    version: "0.0.10",
    date: "2026-08-12",
    notes: "Design foundation for the dashboard rebuild: a radius and elevation scale, lime weights that work on both themes, and the shared pieces the new screens are built from, status pills, tab rows, stat cards, list/detail layout and avatar clusters.",
  },
  {
    version: "0.0.9",
    date: "2026-08-12",
    notes: "Invoices can be read from a PDF or a photo, including scans with no text layer, which is why four amounts were blank. Logo pull now searches a repo properly and finds marks in nested folders. Real ARC logo artwork in the sidebar with the version beside it. Brands grouped Live / Proposed / Completed.",
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
