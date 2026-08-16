/**
 * One writable-field map for every ops table, shared by the route handlers and
 * the chat apply path.
 *
 * The hand-written per-route lists this replaces had drifted: `paid_at` was in
 * the schema and on the type but in neither payments whitelist, so "collected"
 * could never be recorded through the app, and the brands list existed twice
 * with different contents. A field added here is writable everywhere at once,
 * and an unknown field comes back as a 400 naming it rather than a silent drop
 * or a 500 from an update that matched nothing.
 */

type FieldKind = "text" | "number" | "boolean" | "json";

export type TableFields = Record<string, FieldKind>;

export const WRITABLE: Record<string, TableFields> = {
  payments: {
    client: "text",
    item: "text",
    amount: "number",
    due: "text",
    status: "text",
    paid_at: "text",
    payment_type: "text",
    deal_total: "number",
    brand_id: "text",
    project_id: "text",
    service_id: "text",
    received_on: "text",
    stage: "text",
    invoice_no: "text",
    invoice_date: "text",
    sac_code: "text",
    taxable_value: "number",
    gst_rate: "number",
    cgst: "number",
    sgst: "number",
    igst: "number",
    total_invoiced: "number",
    tax_amount: "number",
    gstin: "text",
    tds_section: "text",
    tds_amount: "number",
    net_received: "number",
    currency: "text",
    reconciled: "boolean",
    source: "text",
    // fy is deliberately absent: the payments_set_fy trigger derives it.
  },
  projects: {
    name: "text",
    client: "text",
    status: "text",
    next: "text",
    start_date: "text",
    end_date: "text",
    budget: "number",
    size: "text",
    progress: "number",
    tasks: "json",
    kind: "text",
    category: "text",
    notes: "text",
    links: "json",
    payment_schedule: "json",
    brand_id: "text",
    service_id: "text",
  },
  proposals: {
    name: "text",
    client: "text",
    amount: "number",
    status: "text",
    sent: "text",
    notes: "text",
    brand_id: "text",
    service_id: "text",
  },
  people: {
    name: "text",
    role: "text",
    org: "text",
    relation: "text",
    channel: "text",
    notes: "text",
    avatar_url: "text",
    brand_id: "text",
  },
  brands: {
    name: "text",
    logo_url: "text",
    color: "text",
    notes: "text",
    status: "text",
    kind: "text",
    via_brand_id: "text",
    aliases: "json",
    domains: "json",
    github_repos: "json",
    website: "text",
    owner: "text",
    // GST/billing columns (gstin, place_of_supply, lifetime_revenue…) stay
    // deliberately unwritable from the dashboard — the billing side owns them.
  },
};

/** Keys a whole-row body may carry that are never writable and never an error. */
const IGNORED = new Set(["id", "created_at", "updated_at", "fy"]);

export type PatchResult =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; unknown: string[]; invalid: string[] };

/**
 * Turns a request body into a column patch for `table`.
 *
 * "" and null both mean "clear the field"; numbers are coerced and a
 * non-numeric value is reported rather than written as NaN. Unknown keys are
 * collected for a 400, not dropped — a silent drop is how paid_at stayed
 * unrecordable for a month.
 */
export function buildPatch(table: keyof typeof WRITABLE, body: Record<string, unknown>): PatchResult {
  const fields = WRITABLE[table];
  const patch: Record<string, unknown> = {};
  const unknown: string[] = [];
  const invalid: string[] = [];

  for (const [key, raw] of Object.entries(body)) {
    if (IGNORED.has(key)) continue;
    const kind = fields[key];
    if (!kind) { unknown.push(key); continue; }

    if (raw === "" || raw === null || raw === undefined) { patch[key] = null; continue; }
    if (kind === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) { invalid.push(key); continue; }
      patch[key] = n;
    } else if (kind === "boolean") {
      patch[key] = raw === true || raw === "true";
    } else {
      patch[key] = raw;
    }
  }

  if (unknown.length || invalid.length) return { ok: false, unknown, invalid };

  // Recording when money landed IS marking it paid; asking for both would
  // just invite the two fields to disagree.
  if (table === "payments" && patch.paid_at != null && !("status" in body)) {
    patch.status = "paid";
  }

  return { ok: true, patch };
}

/** The 400 body for a failed buildPatch, naming every offending field. */
export function patchError(res: { unknown: string[]; invalid: string[] }) {
  const parts = [];
  if (res.unknown.length) parts.push(`unknown fields: ${res.unknown.join(", ")}`);
  if (res.invalid.length) parts.push(`non-numeric values in: ${res.invalid.join(", ")}`);
  return { error: parts.join("; ") };
}
