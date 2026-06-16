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
│   ├── api/fetch-rss/route.ts   # RSS feed proxy
│   ├── dashboard/
│   │   ├── campaigns/page.tsx   # Schedule & 90-day sprint
│   │   ├── connections/page.tsx # Connected sources & feeds
│   │   ├── content/page.tsx     # Topic bank, calendar, drafts
│   │   ├── feed/page.tsx        # Signals feed with topic chips
│   │   ├── overview/page.tsx    # Metrics dashboard
│   │   ├── results/page.tsx     # Campaign results
│   │   ├── schedule/page.tsx    # Schedule management
│   │   ├── sources/page.tsx     # Source connections
│   │   ├── voice/page.tsx       # Voice/writing style
│   │   ├── write/page.tsx       # Post writing with AI
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
│   ├── ai-client.ts             # AI client utilities
│   ├── schedule.ts              # Daily schedule blocks & targets
│   └── supabase.ts              # Supabase client
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

### 4. Feed (/dashboard/feed)
- **Signals Feed**: Web search results via Anthropic web_search
- **Topic Chips**: Filter signals by topic with ICP context enrichment
- **AI-Powered**: Uses Haiku with web_search tool (included in API cost)
- **90-Day Recency**: Filters for recent content only

### 5. Connections (/dashboard/connections)
- **Connected Sources**: LinkedIn, Instagram, Twitter, WhatsApp, GCal, GA
- **Listening Feeds**: Track keywords and competitors

### 6. Write (/dashboard/write)
- **AI Writing**: Generate posts with Claude streaming
- **Context-Aware**: Uses signal snippets as context
- **Multi-Format**: Supports LinkedIn, Twitter/X, Instagram formats

### 7. Voice (/dashboard/voice)
- **Writing Style**: Configure brand voice and tone

### 8. Results (/dashboard/results)
- **Campaign Results**: Track performance metrics

---

## AI Actions (/api/ai)

| Action | Model | Description |
|--------|-------|-------------|
| `generate-topics` | Haiku | Brainstorm content ideas |
| `write-post` | Sonnet | Write platform-specific posts |
| `analyze-metrics` | Sonnet | Analyze metrics & suggest actions |
| `generate-dms` | Haiku | Create cold DM scripts |
| `daily-briefing` | Sonnet | Morning priority briefing |
| `fetch-signals` | Haiku | Fetch feed signals via Anthropic web_search |
| `get-topics` | - | Get saved topic chips |
| `save-topic` | - | Save topic chip configuration |

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
ANTHROPIC_API_KEY=your-anthropic-key            # direct Anthropic (write/style/outreach)
OPENROUTER_API_KEY=sk-or-v1-...                 # OpenRouter gateway (many models, optional)
TAVILY_API_KEY=your-tavily-key-here             # reserved
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
NEXT_PUBLIC_SITE_URL=https://arc-liard-two.vercel.app   # used as OpenRouter referer
```

**OpenRouter** — one key, many models (`openai/*`, `anthropic/*`, `google/*`, …).
Server-side client at `src/lib/openrouter.ts`: `openrouterChat()` and `openrouterStream()`.
Add `OPENROUTER_API_KEY` to Vercel → Settings → Environment Variables for production.

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

## Recent Changes

- **v0.2.0** - Migrated feed signals from Tavily to Anthropic web_search (no separate credits)
- **v0.2.1** - Added error handling and type guards to anthropicWebSearch
- **v0.2.2** - Hardened fetch-signals to always return `{ signals: [] }` structure

## Notes

- Responsive design with mobile bottom nav and desktop sidebar
- Dark theme with glassmorphism effects
- Data export/import via TopBar backup/restore
- All AI features require ANTHROPIC_API_KEY to be set
- Feed signals use Anthropic's built-in web_search (no Tavily credits needed for search)
