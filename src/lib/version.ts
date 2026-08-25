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

export const VERSION = "0.0.29";

export const CHANGELOG = [
  {
    version: "0.0.29",
    date: "2026-08-25",
    notes: "Connections page: PROXe pipe is probed for real, listening feeds are tested, and an ICP keyword bank is ranked against what the market actually said. Issues and Updates no longer claim wiring is in progress.",
  },
  {
    version: "0.0.28",
    date: "2026-08-22",
    notes: "Outreach board is a dense lead table like PROXe.",
  },
  {
    version: "0.0.27",
    date: "2026-08-22",
    notes: "Outreach now defaults to showing the full active board. Today's 10 only appears when explicitly collapsed.",
  },
  {
    version: "0.0.26",
    date: "2026-08-16",
    notes: "Tell ARC: a chat strip on the dashboard that turns 'ISIVIS project is done' into a confirmed record change and answers 'what's going on with WindChasers' from the same rollups the panels use. Invoice parsing no longer needs a paid model: the PDF's own text and template rules read BCON's layouts free, with OCR for photos and Haiku only as fallback. Brands attach to mail by their registered domains. Accepting an invoice keeps the GST split and invoice number instead of dropping them. paid_at is finally writable, so collected money has a date. Client fields became a brand picker. GTM, PROXe, the agent queue and the services catalogue re-ported from the Windows branch.",
  },
  {
    version: "0.0.25",
    date: "2026-08-13",
    notes: "Money reads collected, contracted and pending over a chosen period. Every invoice ever issued is now in a billing vault, 40 documents back to 2021, which brought in 25 client brands that were missing entirely. Brands separate overdue from live and agreed-but-not-started from running, with completed grouped by year. Projects open on an 18-day calendar. People is a list with real photos. Focus tasks no longer need a project to exist. The mail browser is gone, replaced by one sync button on the dashboard.",
  },
  {
    version: "0.0.24",
    date: "2026-08-12",
    notes: "Mail page with one-button sync: read the mail, parse anything new, and show what turned up. Attachments open in place. A one-time script handles the Gmail authorisation, since Google will not issue a Gmail token to gcloud's own client.",
  },
  {
    version: "0.0.23",
    date: "2026-08-12",
    notes: "Rename is now a visible button on the brand page rather than hidden behind hover. A brand showing zero owed when its invoice has no amount recorded now says so instead. Mail and attachment routes added so a PDF can be opened in place.",
  },
  {
    version: "0.0.22",
    date: "2026-08-12",
    notes: "Ad spend and website traffic now have panels on screen. Operations no longer claims the ad connectors are unbuilt. Removed a Google Cloud SDK that an installer had dropped inside the repo.",
  },
  {
    version: "0.0.21",
    date: "2026-08-12",
    notes: "Invoices read from email now have a review queue on the Invoices page: scan, see what was read with its confidence, then accept onto an existing blank invoice or create a new row. Nothing is written until accepted.",
  },
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
