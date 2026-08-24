#!/usr/bin/env node
/**
 * The morning routine trigger. Runs on the VPS from cron, not from Vercel Cron.
 *
 *   node scripts/arc-morning.mjs
 *
 * Reads from the VPS environment (same .env.local the agent container uses):
 *   ARC_BASE_URL   e.g. https://arc-liard-two.vercel.app
 *   CRON_SECRET    must match the value set on the ARC Vercel project
 *
 * Deliberately thin. All the work — pulling sources, diffing against yesterday,
 * writing the brief — lives in ARC behind /api/arc/morning-brief. Duplicating any
 * of it here would give us two implementations to keep in step, and the one on
 * the VPS would be the one nobody remembers to update.
 *
 * Exits non-zero when the brief did not get written, so cron's own mailer (or
 * whatever monitors the VPS) surfaces a silent failure instead of swallowing it.
 */

const BASE = (process.env.ARC_BASE_URL || "").replace(/\/+$/, "");
const SECRET = process.env.CRON_SECRET;
const TIMEOUT_MS = 120_000;

function fail(message) {
  console.error(`[arc-morning] ${message}`);
  process.exit(1);
}

if (!BASE) fail("ARC_BASE_URL is not set.");
if (!SECRET) fail("CRON_SECRET is not set. ARC's middleware fails closed without it.");

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

let res;
try {
  // GET, not POST: ARC's middleware treats GET + CRON_SECRET as the machine door.
  // POST is the human door and expects a session cookie we do not have.
  res = await fetch(`${BASE}/api/arc/morning-brief`, {
    method: "GET",
    headers: { Authorization: `Bearer ${SECRET}` },
    signal: controller.signal,
  });
} catch (e) {
  clearTimeout(timer);
  fail(e.name === "AbortError" ? `No response in ${TIMEOUT_MS / 1000}s.` : `Request failed: ${e.message}`);
}
clearTimeout(timer);

const text = await res.text();
if (!res.ok) fail(`HTTP ${res.status}: ${text.slice(0, 400)}`);

let body;
try {
  body = JSON.parse(text);
} catch {
  fail(`Response was not JSON: ${text.slice(0, 400)}`);
}

const stamp = new Date().toISOString();
for (const s of body.sync || []) {
  console.log(`[arc-morning] ${stamp} sync ${s.namespace}/${s.scope}: ${s.ok ? "ok" : "FAILED"} — ${s.detail}`);
}
for (const b of body.briefs || []) {
  console.log(`[arc-morning] ${stamp} brief ${b.brand}: ${b.ok ? "ok" : "FAILED"} — ${b.detail}`);
}

// `ok` is true when at least one brand briefed. A run where every brand failed is
// a failure even though the HTTP call succeeded, and the team would otherwise
// open ARC to yesterday's brief with nothing telling them why.
if (!body.ok) fail(`No brief written for ${body.date}. See the lines above.`);

console.log(`[arc-morning] ${stamp} done for ${body.date}.`);
