# ARC

**ARC** is a GTM (Go-To-Market) Command Center — a personal dashboard for solo founders to manage growth operations.

---

## Project Info

| Property | Value |
|----------|-------|
| **Name** | ARC |
| **Version** | 0.1.0 |
| **Framework** | Next.js 14.2.35 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 3.4.1 |
| **Icons** | Lucide React |
| **AI Provider** | Anthropic Claude (Haiku & Sonnet) |

---

## Directory Structure

```
src/
├── app/
│   ├── api/ai/route.ts          # AI API endpoints
│   ├── dashboard/
│   │   ├── campaigns/page.tsx   # Schedule & 90-day sprint
│   │   ├── connections/page.tsx # Connected sources & feeds
│   │   ├── content/page.tsx     # Topic bank, calendar, drafts
│   │   ├── overview/page.tsx    # Metrics dashboard
│   │   ├── layout.tsx           # Dashboard layout (sidebar + topbar)
│   │   └── page.tsx             # Redirects to /overview
│   ├── page.tsx                 # Root redirect to /dashboard
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
├── components/
│   ├── ai/                      # AI button & panel components
│   ├── campaigns/               # Campaign-related components
│   ├── connections/             # Connection components
│   ├── content/                 # Content management components
│   ├── overview/                # Metric cards, sparklines, weekly log
│   ├── Sidebar.tsx              # Navigation (desktop + mobile)
│   └── TopBar.tsx               # Header with backup/restore
├── hooks/
│   ├── useAI.ts                 # AI request hook
│   └── useLocalStorage.ts       # Local storage persistence
├── lib/
│   ├── connections-defaults.ts  # Default connection data
│   ├── content-defaults.ts      # Default topic data
│   ├── defaults.ts              # Default metrics data
│   └── schedule.ts              # Daily schedule blocks & targets
└── types/
    ├── ai.ts                    # AI-related types
    ├── connections.ts           # Connection types
    ├── content.ts               # Content types
    └── overview.ts              # Metrics types
```

---

## Features

### 1. Overview (/dashboard/overview)
- **Channel Metrics**: LinkedIn, Instagram, Twitter/X, WhatsApp, Sales Pipeline
- **Metric Cards**: Editable with sparkline charts showing 7-day trends
- **Weekly Log**: Activity tracking with channel, action, result, notes
- **AI Analysis**: Brutally honest metrics analysis with action items

### 2. Content (/dashboard/content)
- **Topic Bank**: Content ideas organized by pillars
- **AI Brainstorm**: Generate topic ideas via Claude
- **Content Calendar**: Schedule posts by date
- **Drafts**: Write posts with AI assistance

### 3. Schedule (/dashboard/campaigns)
- **90-Day Sprint**: Progress tracker with day counter
- **Time Blocks**: Visual schedule with "Now" card showing current activity
- **Daily Targets**: Checklist with streak counter
- **AI Briefing**: Morning priority check

### 4. Connections (/dashboard/connections)
- **Connected Sources**: LinkedIn, Instagram, Twitter, WhatsApp, GCal, GA
- **Listening Feeds**: Track keywords and competitors

---

## AI Actions (/api/ai)

| Action | Model | Description |
|--------|-------|-------------|
| `generate-topics` | Haiku | Brainstorm content ideas |
| `write-post` | Sonnet | Write platform-specific posts |
| `analyze-metrics` | Sonnet | Analyze metrics & suggest actions |
| `generate-dms` | Haiku | Create cold DM scripts |
| `daily-briefing` | Sonnet | Morning priority briefing |

---

## Local Storage Keys

All data persists to browser localStorage with prefix `arc:`:

```
arc:linkedin           # LinkedIn metrics
arc:instagram          # Instagram metrics
arc:twitter            # Twitter/X metrics
arc:sales              # Sales pipeline metrics
arc:whatsapp           # WhatsApp metrics
arc:metric-history     # Metrics change history
arc:weekly-log         # Activity log entries
arc:topics             # Content topic bank
arc:calendar           # Content calendar
arc:drafts             # Post drafts
arc:campaigns          # Campaign data
arc:sprint-start       # Sprint start date
arc:daily-targets      # Daily targets history
arc:sources            # Connected sources
arc:feeds              # Listening feeds
```

---

## Environment Variables

```env
ANTHROPIC_API_KEY=your-api-key-here
```

---

## Scripts

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## ICP (Ideal Customer Profile)

Solo founders, coaching academies, clinics (dental/skin/physio), real estate agents, tutoring centers in India with 5-15L/month revenue. They lose leads due to slow WhatsApp replies and lack proper follow-up systems.

---

## Content Pillars

1. **Pain Points** (red) — Problems ICP faces
2. **Marketing Tips** (blue) — Actionable tactics
3. **Build Journey** (green) — Build-in-public content
4. **Client Results** (orange) — Case studies & social proof

---

## Writing Voice

Raw, vulnerable, build-in-public, first person. Short punchy sentences. No corporate fluff. Conversational like texting a friend. Every post ends with a CTA ("DM me DEMO", "Comment LEADS", etc).

---

## Notes

- Responsive design with mobile bottom nav and desktop sidebar
- Dark theme with glassmorphism effects
- Data export/import via TopBar backup/restore
- All AI features require ANTHROPIC_API_KEY to be set
