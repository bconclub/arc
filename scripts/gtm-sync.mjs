#!/usr/bin/env node
// Sync GTM knowledge between ARC (Supabase = master) and an Obsidian vault.
//
//   node scripts/gtm-sync.mjs export   # Supabase -> vault markdown (mirror)
//   node scripts/gtm-sync.mjs import   # vault markdown -> Supabase (write back)
//
// Vault location: env ARC_VAULT_DIR (points at your Obsidian vault root).
// Notes land in <vault>/GTM/<slug>.md with frontmatter (status) + body.
// Requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// in .env.local (same as the app).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---- env ----
const env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  /* fall back to process.env */
}
const get = (k) => process.env[k] || env[k] || "";

const URL = get("SUPABASE_URL") || get("NEXT_PUBLIC_SUPABASE_URL");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");
const VAULT = get("ARC_VAULT_DIR");

if (!URL || !KEY) {
  console.error("Missing Supabase URL / service role key in .env.local");
  process.exit(1);
}
if (!VAULT) {
  console.error('Missing ARC_VAULT_DIR. Set it to your Obsidian vault root, e.g.\n  ARC_VAULT_DIR=C:\\Users\\user\\Documents\\ARC-Vault');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const GTM_DIR = join(VAULT, "GTM");

const fm = (obj) =>
  "---\n" + Object.entries(obj).map(([k, v]) => `${k}: ${v ?? ""}`).join("\n") + "\n---\n";

function parse(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  let body = md;
  if (m) {
    body = m[2];
    for (const line of m[1].split("\n")) {
      const mm = line.match(/^(\w+):\s*(.*)$/);
      if (mm) meta[mm[1]] = mm[2];
    }
  }
  return { meta, body };
}

async function exportToVault() {
  const { data, error } = await db.from("gtm_areas").select("*").order("ord");
  if (error) throw error;
  mkdirSync(GTM_DIR, { recursive: true });
  for (const a of data) {
    const md =
      fm({ slug: a.slug, title: a.title, status: a.status, ord: a.ord, updated_at: a.updated_at }) +
      `\n# ${a.title}\n\n> ${a.what ?? ""}\n\n## Where we stand\n\n${a.stand ?? ""}\n`;
    writeFileSync(join(GTM_DIR, `${a.slug}.md`), md, "utf8");
  }
  console.log(`Exported ${data.length} GTM areas → ${GTM_DIR}`);
}

async function importFromVault() {
  if (!existsSync(GTM_DIR)) {
    console.error(`No GTM folder at ${GTM_DIR} — run export first.`);
    process.exit(1);
  }
  let n = 0;
  for (const file of readdirSync(GTM_DIR).filter((f) => f.endsWith(".md"))) {
    const { meta, body } = parse(readFileSync(join(GTM_DIR, file), "utf8"));
    if (!meta.slug) continue;
    // pull the "Where we stand" section as the authoritative `stand`
    const standMatch = body.match(/##\s*Where we stand\s*\n+([\s\S]*)$/i);
    const stand = (standMatch ? standMatch[1] : "").trim();
    const patch = { status: meta.status || "not_started", stand: stand || null };
    const { error } = await db.from("gtm_areas").update(patch).eq("slug", meta.slug);
    if (error) console.error(`  ${meta.slug}: ${error.message}`);
    else n++;
  }
  console.log(`Imported ${n} GTM areas ← ${GTM_DIR}`);
}

const cmd = process.argv[2];
if (cmd === "export") await exportToVault();
else if (cmd === "import") await importFromVault();
else {
  console.error("Usage: node scripts/gtm-sync.mjs export|import");
  process.exit(1);
}
