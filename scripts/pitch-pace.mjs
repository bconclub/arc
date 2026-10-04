// Evens out the pace of every /pitch narration clip, in place.
// English is set to 135 words a minute; each other language to its own
// median, so one language never speeds up and slows down between cards.
// The deck then plays every clip at 1.15x.
//
//   node scripts/pitch-pace.mjs
import { readFile, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const AUDIO = "public/pitch/audio";
const words = (t) => t.replace(/\[[^\]]+\]/g, "").split(/\s+/).filter(Boolean).length;
const secs = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

async function english() {
  const src = await readFile("scripts/pitch-narration.mjs", "utf8");
  const out = {};
  for (const m of src.matchAll(/^ {2}(\w+): "(.*)",$/gm)) out[m[1]] = m[2];
  return out;
}

async function even(dir, lines, target) {
  const rows = Object.entries(lines)
    .filter(([k]) => existsSync(`${dir}/${k}.mp3`))
    .map(([k, t]) => ({ k, wpm: (words(t) / secs(`${dir}/${k}.mp3`)) * 60 }));
  const sorted = rows.map((r) => r.wpm).sort((a, b) => a - b);
  const goal = target ?? sorted[Math.floor(sorted.length / 2)];
  for (const r of rows) {
    const tempo = Math.min(1.25, Math.max(0.8, goal / r.wpm));
    if (Math.abs(tempo - 1) < 0.03) continue;
    const f = `${dir}/${r.k}.mp3`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", f, "-af", `atempo=${tempo.toFixed(3)}`, "-ac", "1", "-b:a", "64k", `${f}.tmp.mp3`]);
    await rename(`${f}.tmp.mp3`, f);
  }
  console.log(`${dir}: ${rows.length} clips evened to ${goal.toFixed(0)} wpm`);
}

await even(AUDIO, await english(), 135);
for (const d of await readdir(AUDIO, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const json = `scripts/pitch-i18n/${d.name}.json`;
  if (existsSync(json)) await even(`${AUDIO}/${d.name}`, JSON.parse(await readFile(json, "utf8")));
}
