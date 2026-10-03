import { hashPassword } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Owner-side writes behind the investor portal. Each resource names its table,
 * the fields the owner may set, and how a list is ordered. Investors never
 * reach any of this: these routes sit behind the owner session.
 */

type Kind = "text" | "number" | "bool" | "date";

export type Resource = {
  table: string;
  fields: Record<string, Kind>;
  required: string[];
  order: string;
  /** columns returned to the browser — never the password hash */
  select: string;
};

export const RESOURCES: Record<string, Resource> = {
  investors: {
    table: "investors",
    fields: {
      username: "text", name: "text", email: "text",
      round: "text", committed_amount: "number", received_amount: "number", equity_pct: "number", currency: "text", invested_on: "date", active: "bool",
    },
    required: ["username", "name", "password"],
    order: "created_at",
    select: "id,username,name,email,round,committed_amount,received_amount,equity_pct,currency,invested_on,active,last_login_at,created_at",
  },
  updates: {
    table: "investor_updates",
    fields: { title: "text", body_md: "text", kind: "text", stage: "text", published_at: "text", published: "bool", pinned: "bool" },
    required: ["title"],
    order: "published_at",
    select: "*",
  },
  demos: {
    table: "demos",
    fields: {
      company: "text", contact: "text", scheduled_at: "text", status: "text",
      outcome: "text", source: "text", notes: "text", outreach_target_id: "text",
    },
    required: ["company", "scheduled_at"],
    order: "scheduled_at",
    select: "*",
  },
  expenses: {
    table: "expenses",
    fields: {
      spent_on: "date", category: "text", vendor: "text", description: "text",
      amount: "number", currency: "text", recurring: "bool", daily_budget: "number", approved_by: "text", department: "text",
    },
    required: ["spent_on", "amount"],
    order: "spent_on",
    select: "*",
  },
};

export type Built = { ok: true; row: Record<string, unknown> } | { ok: false; error: string };

export async function buildRow(res: Resource, body: Record<string, unknown>, creating: boolean): Promise<Built> {
  const row: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(res.fields)) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === "" || v === null || v === undefined) { row[key] = null; continue; }
    if (kind === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) return { ok: false, error: `${key} must be a number` };
      row[key] = n;
    } else if (kind === "bool") {
      row[key] = v === true || v === "true";
    } else {
      row[key] = String(v).trim();
    }
  }

  if (res.table === "investors") {
    if (typeof row.username === "string") row.username = row.username.toLowerCase();
    const pw = typeof body.password === "string" ? body.password : "";
    if (pw) {
      if (pw.length < 10) return { ok: false, error: "Password must be at least 10 characters." };
      row.password_hash = await hashPassword(pw);
    }
  }

  // An ads post carries its budget and targeting as structured detail, so the
  // portal can show them as fields rather than prose.
  if (res.table === "investor_updates" && ("daily_budget" in body || "targeting" in body)) {
    const n = Number(body.daily_budget);
    row.payload = {
      daily_budget: body.daily_budget === "" || body.daily_budget == null || !Number.isFinite(n) ? null : n,
      targeting: typeof body.targeting === "string" && body.targeting.trim() ? body.targeting.trim() : null,
    };
  }

  // A post addressed to one investor: the owner types their username, blank
  // means everyone. Resolved here so the browser never handles investor ids.
  if (res.table === "investor_updates" && "for_username" in body) {
    const u = String(body.for_username ?? "").trim().toLowerCase();
    if (!u) {
      row.investor_id = null;
    } else {
      const { data } = await supabaseAdmin.from("investors").select("id").eq("username", u).maybeSingle();
      if (!data) return { ok: false, error: `No investor with username "${u}".` };
      row.investor_id = data.id;
    }
  }

  if (creating) {
    const missing = res.required.filter((k) => (k === "password" ? !row.password_hash : row[k] == null));
    if (missing.length) return { ok: false, error: `required: ${missing.join(", ")}` };
  }
  return { ok: true, row };
}
