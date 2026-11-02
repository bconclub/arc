# Master: what the master session knows

The master session (thread "MASTER", working folder `C:\dev\builds\ISIVIS`, running since 2026-10-30) sits above all
the other Claude sessions. It tracks them, pings them, finds work across them, and takes on the cross-brand jobs:
the BCON portfolio, Drive clean-ups, invoices, client packages.

Written 2026-11-02 at the founder's request: "Whatever you have learned, put it in arc under master."

## Read in this order
| File | What it covers |
|---|---|
| [founder-rules.md](founder-rules.md) | How Z works, and every correction Z gave this thread, with what changed |
| [sessions.md](sessions.md) | Which session does what, and how to reach them |
| [portfolio.md](portfolio.md) | How the BCON portfolio is built and how to add to it |
| [methods.md](methods.md) | Working methods: Drive uploads, Gmail attachments, the video library, the montage, quirks we hit |
| `private/` | Client and money details. Local only, see below |

## Public and private
`bconclub/arc` is a **public repo**. Anything committed here can be read by anyone, so this folder holds methods and
rules only.

Everything with client details sits in `docs/master/private/`, which is in `.gitignore` and exists only in the ARC
checkout at `C:\dev\builds\ARC` on the Windows PC:

| Private file | What it covers |
|---|---|
| `private/open-items.md` | Everything unfinished, what each item waits on, and security findings |
| `private/clients.md` | Invoices, Amrit Slesha, healthcare package, ISIVIS, pricing facts |
| `private/ids-and-locations.md` | Drive folder IDs, draft IDs, project IDs, local paths |
| `private/history/` | The full running summaries of the master thread, and the 2026-10-30 portfolio audit |

Never move private content into a tracked file while the repo is public. Other agents: read `private/` if you are on
this PC. If you are on another machine it won't be there, so ask Z.
