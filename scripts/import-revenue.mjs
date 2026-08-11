#!/usr/bin/env node
/**
 * Imports the BCON revenue spreadsheet into public.revenue_history.
 *
 *   node scripts/import-revenue.mjs <file.csv> [--dry]
 *
 * Expects the revenue tab exported as CSV, with columns:
 *   Year, Month, Client, Service Type, Amount
 * Extra columns (running totals, FY summaries) are ignored.
 *
 * Safe to re-run: rows are upserted on (period, client, service_type, amount),
 * so the spreadsheet stays the source of truth and ARC just mirrors it.
 * Historical clients with no brand row are created as dormant brands and the
 * ledger is linked to them.
 */
import fs from "node:fs";

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function env() {
  const out = {};
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Minimal CSV reader — handles quoted fields and embedded commas. */
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
  const n = Number(clean(s).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  const dry = flags.includes("--dry");
  if (!file) {
    console.error("Usage: node scripts/import-revenue.mjs <file.csv> [--dry]");
    process.exit(1);
  }

  const e = env();
  const URL_ = e.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = e.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) throw new Error("Supabase URL/service key missing from .env.local");
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  // Find the header row rather than assuming row 0 — these exports often carry
  // a title or blank rows above the table.
  const headerIdx = rows.findIndex((r) => r.some((c) => /^year$/i.test(clean(c))));
  if (headerIdx === -1) throw new Error('No header row containing "Year" found.');
  const header = rows[headerIdx].map((c) => clean(c).toLowerCase());
  const col = (name) => header.findIndex((h) => h === name);
  const iYear = col("year"), iMonth = col("month"), iClient = col("client");
  const iService = header.findIndex((h) => h.startsWith("service"));
  const iAmount = col("amount");
  if ([iYear, iMonth, iClient, iAmount].some((i) => i === -1)) {
    throw new Error(`Missing a required column. Found: ${header.filter(Boolean).join(", ")}`);
  }

  const ledger = [];
  const skipped = [];
  let year = null, month = null;   // merged cells leave blanks — carry forward

  for (const r of rows.slice(headerIdx + 1)) {
    const y = clean(r[iYear]), m = clean(r[iMonth]);
    if (/^\d{4}$/.test(y)) year = Number(y);
    if (MONTHS[m.toLowerCase()]) month = MONTHS[m.toLowerCase()];

    const client = clean(r[iClient]);
    const amount = money(r[iAmount]);
    if (!client || client === "-" || !amount || amount <= 0) continue;
    if (!year || !month) { skipped.push(`${client}: no year/month`); continue; }

    ledger.push({
      period: `${year}-${String(month).padStart(2, "0")}-01`,
      client,
      service_type: clean(r[iService]) || null,
      amount,
      source: "sheet",
    });
  }

  const total = ledger.reduce((s, x) => s + x.amount, 0);
  const clients = [...new Set(ledger.map((x) => x.client.trim()))].sort();
  console.log(`parsed ${ledger.length} rows · ₹${total.toLocaleString("en-IN")} · ${clients.length} clients`);
  if (skipped.length) console.log(`skipped ${skipped.length} (no year/month)`);
  if (dry) {
    console.log("\nclients:\n  " + clients.join("\n  "));
    console.log("\n--dry: nothing written");
    return;
  }

  // Historical clients become dormant brands so their ledger has somewhere to live.
  const existing = await (await fetch(`${URL_}/rest/v1/brands?select=id,name,aliases`, { headers: H })).json();
  const keyOf = (b) => [b.name, ...(b.aliases ?? [])].map((s) => s.trim().toLowerCase());
  const known = new Map();
  for (const b of existing) for (const k of keyOf(b)) known.set(k, b.id);

  const missing = clients.filter((c) => !known.has(c.toLowerCase()));
  if (missing.length) {
    console.log(`creating ${missing.length} dormant brands…`);
    const res = await fetch(`${URL_}/rest/v1/brands`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify(missing.map((name) => ({ name, kind: "client", status: "dormant" }))),
    });
    if (!res.ok) console.warn("  brand insert:", (await res.text()).slice(0, 200));
    else for (const b of await res.json()) known.set(b.name.trim().toLowerCase(), b.id);
  }

  for (const row of ledger) row.brand_id = known.get(row.client.trim().toLowerCase()) ?? null;

  // Chunked upsert — one 500-row body is enough to trip PostgREST limits.
  let written = 0;
  for (let i = 0; i < ledger.length; i += 200) {
    const chunk = ledger.slice(i, i + 200);
    const res = await fetch(`${URL_}/rest/v1/revenue_history`, {
      method: "POST",
      headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) { console.error(`chunk ${i}:`, (await res.text()).slice(0, 300)); break; }
    written += chunk.length;
    process.stdout.write(`\r  ${written}/${ledger.length}`);
  }
  console.log(`\ndone — ${written} rows, ${known.size} brands linked`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
