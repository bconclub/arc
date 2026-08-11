#!/usr/bin/env node
/**
 * Imports the BCON GST invoice sheet into public.gst_invoices.
 *
 *   node scripts/import-gst.mjs <file.csv> [--dry]
 *
 * The sheet is one table per financial year stacked in a single tab, so the
 * header row repeats and blank spacer rows sit between years. Both are skipped.
 *
 * Safe to re-run: rows upsert on (invoice_no, issued_on, client), which is why
 * the unique index exists. Invoice numbers restart every April, so the number
 * alone is not unique.
 */
import fs from "node:fs";

function env() {
  const out = {};
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Minimal CSV reader: handles quoted fields, which matter here because Indian
 *  digit grouping puts commas inside every amount ("1,66,796"). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => (s ?? "").replace(/ /g, " ").trim();

const money = (s) => {
  const t = clean(s).replace(/[₹,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** The sheet mixes "8-Mar-2023", "04-July-2023" and "24-03-2024". */
function parseDate(s) {
  const t = clean(s);
  if (!t) return null;
  let m = t.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mon) return null;
    return `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  // Day-first: this is an Indian sheet, so 24-03-2024 is 24 March.
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** The sheet's "GST Paid" column carries a status, not a boolean. */
function gstStatus(s) {
  const t = clean(s).toLowerCase();
  if (t.startsWith("yes")) return "filed";
  if (t.startsWith("cancel")) return "cancelled";
  if (t.startsWith("omit")) return "omitted";
  return "unfiled";
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  const dry = flags.includes("--dry");
  if (!file) {
    console.error("Usage: node scripts/import-gst.mjs <file.csv> [--dry]");
    process.exit(1);
  }

  const e = env();
  const URL_ = e.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = e.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) throw new Error("Supabase URL/service key missing from .env.local");
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const invoices = [];
  const problems = [];

  for (const r of rows) {
    const date = clean(r[0]), invoiceNo = clean(r[1]), client = clean(r[2]);
    // Repeated header rows (one per FY) and blank spacers.
    if (!client || /^brand$/i.test(client)) continue;

    let billed = money(r[3]);
    let total = money(r[4]);
    let gst = money(r[5]);

    // One row (Pearl Ports, CRE1054) has its amount columns shifted: billed and
    // total are blank and the figure sits under GST. Recording 72,000 as tax on
    // a blank invoice would be wrong, so it is treated as the billed amount and
    // flagged rather than silently rearranged.
    let note = null;
    if (billed == null && total == null && gst != null) {
      note = "Amount columns shifted in the source sheet; figure recorded as billed amount.";
      billed = gst;
      gst = null;
    }

    // GSTIN can appear in any of the trailing columns.
    const gstin = r.slice(6).map(clean).find((v) => GSTIN_RE.test(v.toUpperCase())) ?? null;

    const issued = parseDate(date);
    if (!issued) problems.push(`${invoiceNo || "(no number)"} ${client}: unreadable date "${date}"`);

    invoices.push({
      invoice_no: invoiceNo || null,
      issued_on: issued,
      client,
      billed_amount: billed,
      total_amount: total,
      gst_amount: gst,
      gstin: gstin ? gstin.toUpperCase() : null,
      gst_status: gstStatus(r[6]),
      notes: note,
    });
  }

  const totalBilled = invoices.reduce((s, x) => s + (x.billed_amount ?? 0), 0);
  const clients = [...new Set(invoices.map((x) => x.client))].sort();
  console.log(`parsed ${invoices.length} invoices · ₹${totalBilled.toLocaleString("en-IN")} billed · ${clients.length} clients`);
  for (const p of problems) console.log(`  ! ${p}`);

  if (dry) {
    console.log("\nclients:\n  " + clients.join("\n  "));
    console.log("\nby status:", JSON.stringify(
      invoices.reduce((a, x) => ({ ...a, [x.gst_status]: (a[x.gst_status] ?? 0) + 1 }), {})));
    console.log("\n--dry: nothing written");
    return;
  }

  // Match to existing brands by name or alias; create the rest as dormant so the
  // invoice history has somewhere to hang.
  const existing = await (await fetch(`${URL_}/rest/v1/brands?select=id,name,aliases`, { headers: H })).json();
  const known = new Map();
  for (const b of existing) {
    for (const k of [b.name, ...(b.aliases ?? [])]) {
      if (k) known.set(k.trim().toLowerCase(), b.id);
    }
  }

  const missing = clients.filter((c) => !known.has(c.toLowerCase()));
  if (missing.length) {
    console.log(`creating ${missing.length} dormant brands: ${missing.join(", ")}`);
    const res = await fetch(`${URL_}/rest/v1/brands`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify(missing.map((name) => ({ name, kind: "client", status: "dormant" }))),
    });
    if (!res.ok) console.warn("  brand insert:", (await res.text()).slice(0, 300));
    else for (const b of await res.json()) known.set(b.name.trim().toLowerCase(), b.id);
  }

  for (const x of invoices) x.brand_id = known.get(x.client.toLowerCase()) ?? null;

  // Skip rows already present rather than relying on ignore-duplicates. The
  // uniqueness rule is a unique INDEX over expressions (coalesce + lower), and
  // PostgREST cannot infer a conflict target from that, so it raises 23505 and
  // the whole batch fails. Filtering here keeps the "safe to re-run" promise.
  const priorRows = await (await fetch(
    `${URL_}/rest/v1/gst_invoices?select=invoice_no,issued_on,client`, { headers: H },
  )).json();
  const keyOf = (x) => `${x.invoice_no ?? ""}|${x.issued_on ?? "1900-01-01"}|${(x.client ?? "").toLowerCase()}`;
  const prior = new Set((Array.isArray(priorRows) ? priorRows : []).map(keyOf));

  const fresh = invoices.filter((x) => !prior.has(keyOf(x)));
  const skipped = invoices.length - fresh.length;

  if (fresh.length) {
    const res = await fetch(`${URL_}/rest/v1/gst_invoices`, {
      method: "POST",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify(fresh),
    });
    if (!res.ok) { console.error("insert failed:", (await res.text()).slice(0, 400)); process.exit(1); }
  }

  const linked = fresh.filter((x) => x.brand_id).length;
  console.log(
    `done: ${fresh.length} written (${linked} linked to a brand)` +
    (skipped ? `, ${skipped} already present` : ""),
  );

  // Backfill GSTINs onto the brands, since the sheet is the only place they exist.
  const byBrand = new Map();
  for (const x of invoices) {
    if (x.brand_id && x.gstin) byBrand.set(x.brand_id, x.gstin);
  }
  let gstinUpdates = 0;
  for (const [id, gstin] of byBrand) {
    const up = await fetch(`${URL_}/rest/v1/brands?id=eq.${id}&gstin=is.null`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ gstin }),
    });
    if (up.ok) gstinUpdates += 1;
  }
  console.log(`GSTIN backfilled on ${gstinUpdates} brands`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
