export type ProjectStatus = "active" | "waiting" | "parked" | "done";
export type ProjectSize = "S" | "M" | "L" | "XL";

export type OpsTask = { text: string; done: boolean; due: string | null };

export type Project = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  next: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  size: ProjectSize | null;
  progress: number;
  tasks: OpsTask[];
  created_at: string;
  updated_at: string;
};

export type Person = {
  id: string;
  name: string;
  role: string | null;
  org: string | null;
  relation: string | null;
  /** Free text: email, phone, or both separated by " / ". */
  channel: string | null;
  notes: string | null;
  /** FK to brands. Populated on most rows and preferred over matching `org`. */
  brand_id?: string | null;
  created_at: string;
};

export type ProposalStatus = "draft" | "sent" | "discussing" | "won" | "lost";

export type Proposal = {
  id: string;
  name: string;
  client: string | null;
  amount: number | null;
  status: ProposalStatus;
  sent: string | null;
  notes: string | null;
  created_at: string;
};

export type PaymentStatus = "pending" | "invoiced" | "overdue" | "paid";

export type Payment = {
  id: string;
  client: string | null;
  item: string | null;
  amount: number | null;
  due: string | null;
  status: PaymentStatus;
  /**
   * When the money actually landed. Optional on the type because the column is
   * added by 20260812100000_payments_paid_at.sql: until that migration runs the
   * field is simply absent from the API response, and everything reading it
   * treats that the same as "not recorded".
   */
  paid_at?: string | null;
  created_at: string;
};

export type OpsSignalSeverity = "info" | "warn" | "high" | "critical";

export type OpsSignal = {
  id: string;
  source: string | null;
  title: string;
  detail: string | null;
  severity: OpsSignalSeverity;
  url: string | null;
  seen: boolean;
  ts: string;
};

export type NowTask = {
  id: string;
  text: string;
  done: boolean;
  due: string | null;
  estimate_minutes: number | null;
  priority: "low" | "medium" | "high" | null;
  created_at: string;
};

/**
 * `brands` is the client register. Status is typed as a plain string because the
 * vocabulary belongs to that table, not this dashboard ('on_track', 'active', …)
 * — never index a lookup map with it without a fallback.
 *
 * Optional fields are genuinely optional: the two Supabase projects this app has
 * pointed at carry slightly different column sets, so anything not guaranteed on
 * both is `?` and every read must tolerate `undefined`.
 */
/**
 * What a brand row represents. Not everything in `brands` pays you — agencies
 * and partners route or deliver work, prospects haven't bought yet, and 'own'
 * covers your own products. Money rollups are only meaningful for clients.
 */
export type BrandKind = "client" | "agency" | "partner" | "prospect" | "own";

export const BRAND_KIND_LABEL: Record<BrandKind, string> = {
  client: "Client",
  agency: "Agency",
  partner: "Partner",
  prospect: "Prospect",
  own: "Our own",
};

export type Brand = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  /** Optional: absent until the brand_kind migration runs. Treat as "client". */
  kind?: BrandKind | null;
  /** Work arrives through this brand — e.g. Kosh Studios via Now Media. */
  via_brand_id?: string | null;
  logo_url: string | null;
  color: string | null;
  github_repos: string[] | null;
  created_at: string;
  updated_at: string;

  // Client-register fields.
  aliases?: string[] | null;
  domains?: string[] | null;
  gstin?: string | null;
  state_code?: string | null;
  place_of_supply?: string | null;
  country?: string | null;
  currency?: string | null;
  is_export?: boolean | null;
  first_seen?: string | null;
  last_seen?: string | null;
  lifetime_revenue?: number | null;

  // Present on this project's table, absent on the older one.
  website?: string | null;
  owner?: string | null;
};

export type GithubRepo = {
  name: string;          // owner/repo
  pushedAt: string | null;
  openIssues: number;
  stars: number;
  private: boolean;
  url: string;
  /** False when a brand links a repo the token cannot read (client-owned, no access). */
  accessible: boolean;
  /** True when the repo belongs to someone else — a client's own account. */
  external: boolean;
};

export type GithubEvent = {
  id: string;
  type: string;          // push | pull_request | issues | create | release
  repo: string;
  actor: string;
  title: string;
  url: string | null;
  ts: string;
};

export type GithubCommit = {
  repo: string;          // owner/repo
  sha: string;
  message: string;       // first line only
  author: string;
  date: string;
  url: string;
};

export type GithubActivity = {
  configured: boolean;
  error: string | null;
  org: string | null;
  repos: GithubRepo[];
  events: GithubEvent[];
  commits: GithubCommit[];
};

/** A brand plus everything rolled up from projects / payments / proposals. */
export type BrandRollup = Brand & {
  owed: number;
  collected: number;
  overdue: number;
  pipeline: number;
  openTasks: number;
  totalTasks: number;
  activeProjects: number;
  /** Projects not yet done — includes waiting and parked, which are still live. */
  openProjects: number;
  /** Unpaid invoices by count, so ones with no amount recorded still register. */
  unpaidCount: number;
  unpricedCount: number;
  projectCount: number;
  avgProgress: number;
  criticalSignals: number;
  health: number;
  moneySeries: number[];
};

export type ServiceStatus = "healthy" | "issue" | "paused" | "failed" | "down";

/**
 * Infrastructure health. Backed by `system_health`, NOT the `services` table —
 * `services` is the GST billing catalogue (SAC codes, tax rates) and must never
 * receive uptime rows.
 */
export type SystemService = {
  id: string;
  name: string;
  category: string | null;
  status: ServiceStatus;
  detail: string | null;
  url: string | null;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandPlatform = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";

export type BrandMetric = {
  id: string;
  platform: BrandPlatform;
  recorded_on: string;
  followers: number | null;
  reach: number | null;
  engagement: number | null;
  notes: string | null;
  created_at: string;
};

export type ContentPlanStatus = "idea" | "draft" | "scheduled" | "posted";

export type ContentPlanItem = {
  id: string;
  title: string;
  platform: BrandPlatform | null;
  status: ContentPlanStatus;
  planned_date: string | null;
  idea_id: number | null;
  post_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PetState = "fire" | "alert" | "happy" | "sleeping";
