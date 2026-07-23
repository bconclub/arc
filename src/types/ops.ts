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
  channel: string | null;
  notes: string | null;
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
  created_at: string;
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
