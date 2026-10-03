#!/usr/bin/env node
/**
 * Runs a SQL file against the ARC database through the service-role-only
 * exec_sql function (migration 20261003030000). Statements run one at a time
 * so an error names the statement that failed.
 *
 *   node scripts/run-sql.mjs supabase/migrations/<file>.sql
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/run-sql.mjs <file.sql>"); process.exit(1); }

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing Supabase env"); process.exit(1); }

/** Split on semicolons outside quotes, dollar-quoted bodies and comments. */
function statements(sql) {
  const out = [];
  let cur = "", i = 0, quote = null, dollar = null;
  while (i < sql.length) {
    const c = sql[i], rest = sql.slice(i);
    if (!quote && !dollar && rest.startsWith("--")) {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (!quote) {
      const d = rest.match(/^\$[A-Za-z_]*\$/);
      if (d) {
        if (dollar === d[0]) dollar = null;
        else if (!dollar) dollar = d[0];
        cur += d[0]; i += d[0].length; continue;
      }
    }
    if (!dollar && (c === "'" || c === '"')) {
      if (quote === c) quote = null; else if (!quote) quote = c;
    }
    if (c === ";" && !quote && !dollar) {
      if (cur.trim()) out.push(cur.trim());
      cur = ""; i++; continue;
    }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const sql = readFileSync(file, "utf8");
const list = statements(sql).filter((s) => !/^select\b/i.test(s));
console.log(`${file}: ${list.length} statements`);

for (const [n, stmt] of list.entries()) {
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql: stmt }),
  });
  if (!res.ok) {
    console.error(`FAILED at statement ${n + 1}:\n${stmt.slice(0, 300)}\n→ ${res.status} ${await res.text()}`);
    process.exit(1);
  }
}
console.log("ok");
