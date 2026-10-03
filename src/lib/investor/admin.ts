import { hashPassword } from "@/lib/auth";

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
      committed_amount: "number", currency: "text", invested_on: "date", active: "bool",
    },
    required: ["username", "name", "password"],
    order: "created_at",
    select: "id,username,name,email,committed_amount,currency,invested_on,active,last_login_at,created_at",
  },
  updates: {
    table: "investor_updates",
    fields: { title: "text", body_md: "text", kind: "text", published_at: "text", published: "bool" },
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
      amount: "number", currency: "text", recurring: "bool", daily_budget: "number",
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

  if (creating) {
    const missing = res.required.filter((k) => (k === "password" ? !row.password_hash : row[k] == null));
    if (missing.length) return { ok: false, error: `required: ${missing.join(", ")}` };
  }
  return { ok: true, row };
}
