#!/usr/bin/env node
// One-time setup of the Fleet session reporter on a machine.
//
//   node workers/fleet/setup.mjs <machine> <fleet-key>
//   e.g. node workers/fleet/setup.mjs bcon-worker abc123...
//
// <machine> is bcon-main, bcon-worker or mac-worker. <fleet-key> is ARC_FLEET_SECRET
// (copy it from ~/.arc-fleet.env on a machine that already reports, or from Vercel).
// Writes ~/.arc-fleet.env and adds the report.mjs hooks to ~/.claude/settings.json,
// keeping every other setting. Safe to run again. Then send one test report.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const [machine, key] = process.argv.slice(2);
const MACHINES = ["bcon-main", "bcon-worker", "mac-worker"];
if (!MACHINES.includes(machine) || !key) {
  console.error(`Usage: node workers/fleet/setup.mjs <${MACHINES.join("|")}> <fleet-key>`);
  process.exit(1);
}

const home = homedir();
const envPath = join(home, ".arc-fleet.env");
writeFileSync(envPath, `ARC_URL=https://arc.bconclub.com\nARC_FLEET_SECRET=${key}\nFLEET_MACHINE=${machine}\n`, { mode: 0o600 });
console.log(`wrote ${envPath}`);

// Forward slashes work for node on Windows and keep the JSON readable.
const reporter = resolve(dirname(fileURLToPath(import.meta.url)), "report.mjs").replace(/\\/g, "/");
const command = `node ${reporter}`;
const settingsPath = join(home, ".claude", "settings.json");
mkdirSync(dirname(settingsPath), { recursive: true });
let settings = {};
if (existsSync(settingsPath)) {
  try { settings = JSON.parse(readFileSync(settingsPath, "utf8")); }
  catch { console.error(`${settingsPath} is not valid JSON; fix it and run again.`); process.exit(1); }
  writeFileSync(`${settingsPath}.bak`, readFileSync(settingsPath));
}
settings.hooks ??= {};
for (const event of ["SessionStart", "UserPromptSubmit", "Stop", "Notification", "SessionEnd"]) {
  const groups = (settings.hooks[event] ??= []);
  const present = groups.some((g) => (g.hooks || []).some((h) => typeof h.command === "string" && h.command.includes("fleet/report.mjs")));
  if (!present) groups.push({ hooks: [{ type: "command", command }] });
}
writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log(`hooks added to ${settingsPath} (backup: settings.json.bak)`);

// One test report, so the machine shows Online in ARC right away.
const test = spawnSync(process.execPath, [reporter], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: process.cwd() }), encoding: "utf8" });
console.log(test.status === 0 ? "test report sent; open ARC > Fleet" : `test report failed: ${test.stderr || test.status}`);
