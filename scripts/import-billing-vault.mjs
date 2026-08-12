#!/usr/bin/env node
/**
 * Loads the parsed BCON invoice sheet into billing_documents.
 *
 *   node scripts/import-billing-vault.mjs <parsed.json> [--dry]
 *
 * Every document goes in, invoice or quote, back to 2021. Nothing is written to
 * `payments`: that table drives receivables, and 38 historical invoices in it
 * would report roughly Rs 20 lakh outstanding that was collected years ago.
 *
 * Settlement stays 'unknown'. The sheet records what was billed and says
 * nothing about what was paid, so marking any of these paid would be invention.
 *
 * Re-running is safe. Existing keys are read first and matching rows filtered
 * out client-side, because the uniqueness rule is an index over expressions and
 * PostgREST cannot infer that as a conflict target for on-conflict handling.
 */
import fs from "node:fs";

const env = {};
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The sheet is Indian and day-first: 03-06-2023 is 3 June. */
function toIso(d) {
  if (!d) return null;
  const m = d.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Names in the sheet that are a person or a variant of an existing brand. */
const ALIAS = {
  ishithagupta: "ISIVIS Group",
  arvinsoftwarellp: "WOWBUS (Arvin Software LLP)",
  laptopstore: "Laptop Store",
  turquoiseholidays: "Turquoise",
  windchasers: "WindChasers",
  purpledotgamesllp: "Purple Dot",
  osiyaenterprises: "OSIYA",
  snackbagsfoodllp: "Snackbags",
  houseofconcepts: "House of Concepts",
  nowmedia: "Now Media",
  ig3infraltd: "IG3 Infra Ltd",
  digileumtechnologiesprivatelimited: "Digileum Technologies",
  baumefoodsllp: "Baume Foods",
  sribasaveshwaragroupofinstitutuons: "Sri Basaveshwara Group of Institutions",
};

async function main() {
  const file = process.argv[2];
  const dry = process.argv.includes("--dry");
  if (!file) {
    console.error("Usage: node scripts/import-billing-vault.mjs <parsed.json> [--dry]");
    process.exit(1);
  }
  const docs = JSON.parse(fs.readFileSync(file, "utf8"));

  const brands = await (await fetch(`${URL_BASE}/rest/v1/brands?select=id,name,aliases`, { headers: H })).json();
  const byKey = new Map();
  for (const b of brands) {
    byKey.set(norm(b.name), b.id);
    for (const a of b.aliases ?? []) byKey.set(norm(a), b.id);
  }
  const brandFor = (name) => byKey.get(norm(ALIAS[norm(name)] ?? name)) ?? byKey.get(norm(name)) ?? null;

  const rows = docs.map((d) => ({
    kind: d.kind,
    doc_no: d.no || null,
    client_id: d.client_id || null,
    issued_on: toIso(d.date),
    client_name: d.client,
    brand_id: brandFor(d.client),
    amount: d.total ? Number(d.total) : null,
    gst_pct: d.gst_pct ? Number(d.gst_pct) : null,
    billed_as: d.entity || null,
    description: d.description || null,
    settlement: "unknown",
    source: "bcon-invoice-sheet",
    notes: d.kind === "unclear"
      ? "The document contradicts itself: its title and its numbering field disagree on whether it is an invoice or a quote."
      : null,
  }));

  const unmatched = rows.filter((r) => !r.brand_id);
  if (unmatched.length) {
    console.log(`\n${unmatched.length} document(s) matched no brand:`);
    unmatched.forEach((r) => console.log(`  ${r.client_name}`));
  }

  // A dry run must work before the table exists, since its whole purpose is to
  // show what would be written while there is still time to object.
  const probe = await (await fetch(
    `${URL_BASE}/rest/v1/billing_documents?select=doc_no,client_name,issued_on&limit=5000`, { headers: H },
  )).json();
  const tableMissing = !Array.isArray(probe);
  if (tableMissing && !dry) {
    console.error("Could not read billing_documents:", probe.message ?? probe);
    console.error("Run supabase/migrations/20260813010000_billing_vault.sql first.");
    process.exit(1);
  }
  const existing = tableMissing ? [] : probe;
  const seen = new Set(existing.map((r) => `${r.doc_no ?? ""}|${(r.client_name ?? "").toLowerCase()}|${r.issued_on ?? ""}`));
  const fresh = rows.filter((r) => !seen.has(`${r.doc_no ?? ""}|${r.client_name.toLowerCase()}|${r.issued_on ?? ""}`));

  const inv = rows.filter((r) => r.kind === "invoice");
  console.log(`\n${rows.length} documents parsed: ${inv.length} invoices, ` +
    `${rows.filter((r) => r.kind === "quote").length} quotes, ` +
    `${rows.filter((r) => r.kind === "unclear").length} unclear`);
  console.log(`with GST ${rows.filter((r) => r.gst_pct).length}, without ${rows.filter((r) => !r.gst_pct).length}`);
  console.log(`invoiced total Rs ${inv.reduce((s, r) => s + (r.amount ?? 0), 0).toLocaleString("en-IN")}`);
  console.log(`${existing.length} already stored, ${fresh.length} to insert`);

  if (dry) { console.log("\nDry run, nothing written."); return; }
  if (!fresh.length) { console.log("\nNothing new."); return; }

  const res = await fetch(`${URL_BASE}/rest/v1/billing_documents`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(fresh),
  });
  const body = await res.json();
  if (!res.ok) { console.error("Insert failed:", body.message ?? JSON.stringify(body).slice(0, 400)); process.exit(1); }
  console.log(`\nWrote ${body.length} documents.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
