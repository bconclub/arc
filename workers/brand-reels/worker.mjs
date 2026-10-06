#!/usr/bin/env node
/**
 * Brand Reels worker: the bridge between ARC's queue and whoever makes the reel.
 *
 * Pull mode (default way of working): your own Claude Code session drives it.
 *   node worker.mjs list                 what is waiting in ARC
 *   node worker.mjs pull                 claim the next link, download it, write job.json, print JOB_DIR
 *   node worker.mjs progress <stage> <pct> "<note>"   from inside JOB_DIR, moves the ARC progress bar
 *   node worker.mjs push [JOB_DIR]       upload out/manifest.json, reel goes to review in ARC
 *   node worker.mjs fail [JOB_DIR] "<reason>"
 *   node worker.mjs import --ig <url> --file final.mp4 --title "..."   add a finished video to the library
 *
 * Daemon mode (optional, unattended Mac): headless Claude makes every job as it arrives.
 *   node worker.mjs [loop]  |  once  |  doctor
 *
 * The queue lives in ARC (agent_jobs, kind 'brand_reel'). Each job:
 *   1. download   yt-dlp (gallery-dl fallback) into <job>/ref, frames + contact sheet
 *   2. breakdown..edit   headless Claude Code with the brand-reel skill does the creative work
 *   3. upload     every file in out/manifest.json to ARC Storage and to Drive
 *   4. review     the reel lands in ARC's Brand Reels page for approve / request changes
 *
 * Zero npm dependencies. Node 18+. Config from .env next to this file (see .env.example).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { driveConfigured, ensureFolderPath, uploadFile as driveUpload } from "./drive.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "brand-reels/0.1.0";
loadEnv(path.join(HERE, ".env"));

const ARC_URL = (process.env.ARC_URL || "https://arc.bconclub.com").replace(/\/$/, "");
const SECRET = process.env.ARC_INGEST_SECRET || "";
const AGENT = process.env.AGENT_NAME || "mac-editor";
const HOME = expand(process.env.BRAND_REELS_HOME || "~/BrandReels");
const POLL_S = Number(process.env.POLL_SECONDS || 30);
const JOB_TIMEOUT_MIN = Number(process.env.JOB_TIMEOUT_MIN || 150);
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
function expand(p) { return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p; }
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with retries on network errors. Long blocking steps (ffmpeg, Claude) leave pooled
 *  keep-alive sockets that the server has already closed; the first reuse then fails. */
async function netFetch(url, init, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fetch(url, init); } catch (e) {
      if (i >= tries) throw e;
      await sleep(1000 * i * i);
    }
  }
}

async function arc(route, body) {
  const r = await netFetch(`${ARC_URL}${route}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "x-agent-name": AGENT, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${route} ${r.status}: ${j.error || "no body"}`);
  return j;
}
const reelApi = (body) => arc("/api/agent/brand-reels", body);
const heartbeat = (note) => arc("/api/agent/heartbeat", { version: VERSION, note }).catch((e) => log("heartbeat failed", e.message));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} failed: ${(r.stderr || r.stdout || r.error?.message || "").slice(-800)}`);
  }
  return r;
}
const has = (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd]).status === 0;

function probe(file) {
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { allowFail: true });
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? d : undefined;
}

// ── 1. Download the reference ─────────────────────────────────

const VIDEO = /\.(mp4|mov|webm|mkv)$/i;
const IMAGE = /\.(jpe?g|png|webp|heic)$/i;

function download(url, refDir) {
  fs.mkdirSync(refDir, { recursive: true });
  const existing = fs.readdirSync(refDir).filter((f) => VIDEO.test(f) || IMAGE.test(f));
  if (!existing.length) {
    const cookies = process.env.IG_COOKIES_BROWSER ? ["--cookies-from-browser", process.env.IG_COOKIES_BROWSER] : [];
    const yt = run("python3", ["-m", "yt_dlp", ...cookies, "--no-playlist", "--write-info-json", "-o", path.join(refDir, "source.%(ext)s"), url], { allowFail: true });
    if (yt.status !== 0 && has("gallery-dl")) {
      // Image posts and carousels: yt-dlp only does video, gallery-dl takes every slide.
      const gcookies = process.env.IG_COOKIES_BROWSER ? ["--cookies-from-browser", process.env.IG_COOKIES_BROWSER] : [];
      run("gallery-dl", [...gcookies, "--write-metadata", "-D", refDir, "-f", "slide_{num:>02}.{extension}", url], { allowFail: true });
    }
  }
  const files = fs.readdirSync(refDir).sort();
  const videos = files.filter((f) => VIDEO.test(f)).map((f) => path.join(refDir, f));
  const images = files.filter((f) => IMAGE.test(f) && !f.startsWith("sheet")).map((f) => path.join(refDir, f));
  if (!videos.length && !images.length) {
    throw new Error("Could not download the post. If it is private or login-gated, set IG_COOKIES_BROWSER=chrome in .env on the Mac (Chrome must be logged in to Instagram).");
  }

  let meta = {};
  const info = files.find((f) => f.endsWith(".info.json") || f.endsWith(".json"));
  if (info) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(refDir, info), "utf8"));
      meta = { handle: j.uploader_id || j.channel || j.username || j.owner?.username, caption: (j.description || j.caption || "").slice(0, 2000) };
    } catch { /* metadata is a nice-to-have */ }
  }

  const sheet = path.join(refDir, "sheet.jpg");
  const framesDir = path.join(refDir, "frames");
  let duration;
  if (videos.length) {
    duration = probe(videos[0]);
    fs.mkdirSync(framesDir, { recursive: true });
    // One frame a second (capped at 60) for Claude to read, plus a 5x4 sheet for humans.
    const fps = duration && duration > 60 ? 60 / duration : 1;
    run("ffmpeg", ["-v", "error", "-y", "-i", videos[0], "-vf", `fps=${fps},scale=540:-2`, "-q:v", "3", path.join(framesDir, "f_%03d.jpg")]);
    const step = Math.max(0.5, (duration || 20) / 20);
    run("ffmpeg", ["-v", "error", "-y", "-i", videos[0], "-vf", `fps=1/${step},scale=270:-2,tile=5x4:padding=4:color=black`, "-frames:v", "1", "-q:v", "3", sheet]);
  } else {
    // Carousel: tile the slides into the same kind of sheet.
    const list = images.slice(0, 20);
    const inputs = list.flatMap((f) => ["-i", f]);
    const scaled = list.map((_, i) => `[${i}:v]scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2[s${i}]`).join(";");
    const cols = Math.min(5, list.length);
    const layout = list.map((_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join("|");
    const fc = list.length > 1
      ? `${scaled};${list.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${list.length}:layout=${layout}:fill=black`
      : `[0:v]scale=270:480:force_original_aspect_ratio=decrease`;
    run("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", fc, "-frames:v", "1", "-q:v", "3", sheet], { allowFail: true });
  }
  return { videos, images, sheet: fs.existsSync(sheet) ? sheet : null, duration, kind: videos.length ? "video" : "carousel", ...meta };
}

// ── Storage + Drive upload ────────────────────────────────────

async function toStorage(reelId, file, name) {
  const { path: objectPath, signedUrl } = await reelApi({ action: "upload_url", reel_id: reelId, name });
  const type = VIDEO.test(name) ? "video/mp4" : IMAGE.test(name) ? "image/jpeg" : /\.(mp3|wav|m4a)$/i.test(name) ? "audio/mpeg" : "text/plain";
  const r = await netFetch(signedUrl, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "true" }, body: fs.readFileSync(file) });
  if (!r.ok) throw new Error(`storage upload ${name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return objectPath;
}

// ── 2. The creative run: headless Claude Code with the skill ──

function runClaude(jobDir, env, onCancelCheck) {
  return new Promise((resolve, reject) => {
    const prompt = [
      "Use the brand-reel skill.",
      `Your job file is ${path.join(jobDir, "job.json")}. Read it first, then follow the skill end to end.`,
      "Work only inside this folder. Report progress with the progress command from the skill.",
      "Finish by writing out/manifest.json exactly as the skill specifies. Do not ask questions: decide, note the decision in out/NOTES.md, keep going.",
    ].join("\n");
    const args = ["-p", prompt, "--dangerously-skip-permissions", "--output-format", "json"];
    if (CLAUDE_MODEL) args.push("--model", CLAUDE_MODEL);
    const logFile = fs.openSync(path.join(jobDir, "claude.log"), "a");
    // A .mjs CLAUDE_BIN is a stand-in script (dry runs); anything else is the real CLI.
    const [bin, binArgs] = /\.m?js$/.test(CLAUDE_BIN) ? [process.execPath, [CLAUDE_BIN, ...args]] : [CLAUDE_BIN, args];
    const child = spawn(bin, binArgs, { cwd: jobDir, env: { ...process.env, ...env }, stdio: ["ignore", logFile, logFile] });

    const deadline = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`Claude run passed ${JOB_TIMEOUT_MIN} min, stopped.`)); }, JOB_TIMEOUT_MIN * 60_000);
    const watch = setInterval(async () => {
      if (await onCancelCheck()) { child.kill("SIGTERM"); clearTimeout(deadline); clearInterval(watch); reject(new Error("cancelled in ARC")); }
    }, 30_000);
    child.on("exit", (code) => {
      clearTimeout(deadline); clearInterval(watch); fs.closeSync(logFile);
      code === 0 ? resolve() : reject(new Error(`claude exited ${code}. Tail of claude.log:\n${tail(path.join(jobDir, "claude.log"))}`));
    });
    child.on("error", (e) => { clearTimeout(deadline); clearInterval(watch); reject(e); });
  });
}
function tail(file, n = 1500) { try { const s = fs.readFileSync(file, "utf8"); return s.slice(-n); } catch { return ""; } }

// ── One job: prepare (download, job.json) -> create (Claude) -> finish (upload, review) ──

const pad2 = (n) => String(n).padStart(2, "0");

/** Downloads the reference and writes job.json. Shared by the daemon and `pull`. */
async function prepareJob(job) {
  const { reel_id: reelId, version } = job.payload || {};
  if (!reelId) throw new Error("job has no reel_id");
  const { reel } = await reelApi({ action: "get", reel_id: reelId });
  const code = (reel.ig_url.match(/\/(?:reel|p|tv)\/([^/]+)/) || [])[1] || reelId.slice(0, 8);
  const reelDir = path.join(HOME, `${code}-${reelId.slice(0, 8)}`);
  const jobDir = path.join(reelDir, `v${pad2(version)}`);
  const refDir = path.join(reelDir, "ref");
  fs.mkdirSync(path.join(jobDir, "out"), { recursive: true });
  await heartbeat(`making ${reel.title || code} v${version}`);

  await reelApi({ action: "progress", reel_id: reelId, stage: "download", progress: 3, note: "downloading the original" });
  const ref = download(reel.ig_url, refDir);
  const refPatch = { kind: ref.kind, duration: ref.duration, handle: ref.handle, caption: ref.caption };
  if (ref.sheet && !reel.ref?.sheet) refPatch.sheet = await toStorage(reelId, ref.sheet, "ref-sheet.jpg");
  await reelApi({ action: "progress", reel_id: reelId, stage: "breakdown", progress: 10, note: `got ${ref.kind}${ref.duration ? `, ${ref.duration.toFixed(1)}s` : ""}`, ref: refPatch });

  const previous = (reel.outputs || []).filter((o) => o.version === version - 1);
  const prevDir = path.join(reelDir, `v${pad2(version - 1)}`);
  fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify({
    job_id: job.id, reel_id: reelId, version, code, brand: reel.brand, ig_url: reel.ig_url,
    title: reel.title || null,
    brief: reel.note || null,
    feedback: version > 1 ? reel.feedback : null,
    previous_version: version > 1 ? { dir: fs.existsSync(prevDir) ? prevDir : null, outputs: previous.map((o) => ({ kind: o.kind, name: o.name, url: o.url })) } : null,
    ref: { dir: refDir, videos: ref.videos, images: ref.images, frames: path.join(refDir, "frames"), sheet: ref.sheet, duration: ref.duration, handle: ref.handle, caption: ref.caption, kind: ref.kind },
    breakdown_cache: fs.existsSync(path.join(refDir, "breakdown.md")) ? path.join(refDir, "breakdown.md") : null,
    tools: path.join(HERE, "tools"), endcard: path.join(HERE, "endcard"),
    progress: `node "${path.join(HERE, "worker.mjs")}" progress`,
    out: path.join(jobDir, "out"),
  }, null, 2));
  return jobDir;
}

const readJob = (jobDir) => JSON.parse(fs.readFileSync(path.join(jobDir, "job.json"), "utf8"));

/** Uploads everything in out/manifest.json to ARC (and Drive) and moves the reel to review. */
async function finishJob(jobDir) {
  const job = readJob(jobDir);
  const { reel_id: reelId, version, brand, code } = job;
  const manifestPath = path.join(jobDir, "out", "manifest.json");
  const blocked = path.join(jobDir, "out", "BLOCKED.md");
  if (!fs.existsSync(manifestPath) && fs.existsSync(blocked)) throw new Error(`Blocked: ${fs.readFileSync(blocked, "utf8").slice(0, 2000)}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`No out/manifest.json in ${jobDir}. Tail of claude.log:\n${tail(path.join(jobDir, "claude.log"))}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = (manifest.outputs || []).map((o) => ({ ...o, abs: path.resolve(jobDir, o.file) }));
  const missing = files.filter((o) => !fs.existsSync(o.abs));
  if (missing.length) throw new Error(`manifest lists files that are not on disk: ${missing.map((m) => m.file).join(", ")}`);
  if (files.filter((o) => o.kind === "final").length !== 1) throw new Error("manifest needs exactly one final");
  await reelApi({ action: "progress", reel_id: reelId, stage: "upload", progress: 92, note: `uploading ${files.length} files` });

  let breakdown = null;
  const bd = manifest.breakdown ? path.resolve(jobDir, manifest.breakdown) : job.ref?.dir ? path.join(job.ref.dir, "breakdown.md") : "";
  if (bd && fs.existsSync(bd)) breakdown = fs.readFileSync(bd, "utf8").slice(0, 20000);

  let driveFolder = null;
  let driveFolderUrl = null;
  if (driveConfigured()) {
    try {
      const slug = (manifest.slug || manifest.title || code).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      driveFolder = await ensureFolderPath([brand, "Brand-Reels", slug, `v${pad2(version)}`]);
      driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolder}`;
    } catch (e) { log("drive folder failed, continuing without Drive:", e.message); }
  }

  const outputs = [];
  for (const f of files) {
    const name = path.basename(f.abs);
    const storagePath = await toStorage(reelId, f.abs, name);
    let drive_url;
    if (driveFolder) {
      try { drive_url = await driveUpload(f.abs, name, driveFolder); } catch (e) { log("drive upload failed", name, e.message); }
    }
    outputs.push({ kind: f.kind, name, path: storagePath, size: fs.statSync(f.abs).size, duration: VIDEO.test(name) ? probe(f.abs) : undefined, drive_url });
  }

  await reelApi({
    action: "complete", reel_id: reelId, version, outputs,
    title: manifest.title, code: manifest.code, drive_folder_url: driveFolderUrl,
    ref: breakdown ? { breakdown } : undefined,
  });
  if (job.job_id) await arc("/api/agent/result", { job_id: job.job_id, status: "done", result: { outputs: outputs.length, drive: !!driveFolder } });
  return { outputs: outputs.length, drive: !!driveFolder };
}

/** Reports a failure on both the job (retry budget) and the reel the team sees. */
async function failJob(jobId, reelId, msg) {
  const res = jobId ? await arc("/api/agent/result", { job_id: jobId, status: "failed", error: msg }).catch(() => ({})) : {};
  if (reelId) await reelApi({ action: "fail", reel_id: reelId, error: msg, requeued: !!res.requeued }).catch(() => {});
}
const errText = (e) => String((e.message || e) + (e.cause ? ` (${e.cause.code || e.cause.message})` : "")).slice(0, 3000);

/** Daemon mode: this machine runs headless Claude itself. */
async function claimAndRun() {
  const { job } = await arc("/api/agent/next", { kinds: ["brand_reel"] });
  if (!job) return false;
  log("claimed", job.id, JSON.stringify(job.payload));
  try {
    const jobDir = await prepareJob(job);
    const { reel_id: reelId, version } = job.payload;
    await runClaude(jobDir, {
      BR_REEL_ID: reelId, BR_VERSION: String(version), BR_JOB_DIR: jobDir,
      BR_TOOLS: path.join(HERE, "tools"), BR_ENDCARD: path.join(HERE, "endcard"),
      BR_PROGRESS: `node "${path.join(HERE, "worker.mjs")}" progress`,
    }, async () => {
      const r = await reelApi({ action: "get", reel_id: reelId }).catch(() => null);
      return r?.reel?.status === "cancelled";
    });
    const result = await finishJob(jobDir);
    log("done", job.id, JSON.stringify(result));
  } catch (e) {
    const msg = errText(e);
    log("failed", job.id, msg);
    if (msg !== "cancelled in ARC") await failJob(job.id, job.payload?.reel_id, msg);
    else await arc("/api/agent/result", { job_id: job.id, status: "failed", error: msg }).catch(() => {});
  }
  return true;
}

async function loop() {
  if (!SECRET) { console.error("ARC_INGEST_SECRET missing. Put it in workers/brand-reels/.env"); process.exit(1); }
  fs.mkdirSync(HOME, { recursive: true });
  log(`${VERSION} as ${AGENT} -> ${ARC_URL}, jobs in ${HOME}`);
  let lastBeat = 0;
  for (;;) {
    try {
      if (Date.now() - lastBeat > 60_000) { await heartbeat("idle"); lastBeat = Date.now(); }
      const did = await claimAndRun();
      if (did) { lastBeat = 0; continue; }   // more may be waiting: check again straight away
    } catch (e) {
      log("loop error", e.message);
    }
    await sleep(POLL_S * 1000);
  }
}

// ── Subcommands ───────────────────────────────────────────────

function doctor() {
  const checks = [
    ["node 18+", Number(process.versions.node.split(".")[0]) >= 18],
    ["ffmpeg", has("ffmpeg")], ["ffprobe", has("ffprobe")],
    ["python3", has("python3")],
    ["yt-dlp (python3 -m yt_dlp)", spawnSync("python3", ["-m", "yt_dlp", "--version"]).status === 0],
    ["gallery-dl (carousels, optional)", has("gallery-dl")],
    ["claude CLI", has(CLAUDE_BIN) || fs.existsSync(CLAUDE_BIN)],
    ["brand-reel skill installed", fs.existsSync(path.join(os.homedir(), ".claude", "skills", "brand-reel", "SKILL.md"))],
    ["npx (end card render, optional)", has("npx")],
    ["ARC_INGEST_SECRET", !!SECRET],
    ["OPENAI_API_KEY (stills)", !!process.env.OPENAI_API_KEY],
    ["ARK_API_KEY (Seedance motion)", !!process.env.ARK_API_KEY || fs.existsSync(path.join(HERE, "tools", "ark.key"))],
    ["ELEVENLABS_API_KEY (music, sfx)", !!process.env.ELEVENLABS_API_KEY],
    ["Drive (GDRIVE_* set)", driveConfigured()],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? "ok  " : "MISS"}  ${name}`);
  return checks.every(([n, ok]) => ok || /optional|Drive/.test(n));
}

/** The job folder: an explicit path, else the current folder if it holds job.json. */
function jobDirArg(arg) {
  const d = path.resolve(arg || ".");
  if (!fs.existsSync(path.join(d, "job.json"))) { console.error(`No job.json in ${d}. Pass the job folder printed by "pull".`); process.exit(1); }
  return d;
}
function flags(args) {
  const o = {};
  for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) { o[args[i].slice(2)] = args[i + 1]; i++; }
  return o;
}

const COMMANDS = {
  // What is waiting in ARC.
  async list() {
    const { reels } = await reelApi({ action: "list" });
    if (!reels.length) return console.log("Queue empty.");
    for (const r of reels) console.log(`${r.status.padEnd(10)} v${r.version}  ${r.brand.padEnd(6)} ${r.title || r.ig_url}${r.note ? `  | brief: ${r.note}` : ""}${r.feedback ? `  | changes: ${r.feedback}` : ""}`);
  },
  // Claim the next link, download it, write job.json. Prints the folder to work in.
  async pull() {
    const { job } = await arc("/api/agent/next", { kinds: ["brand_reel"] });
    if (!job) { console.log("Queue empty. Nothing to pull."); process.exit(3); }
    try {
      const jobDir = await prepareJob(job);
      const j = readJob(jobDir);
      console.log(`PULLED ${j.title || j.code} v${j.version} (${j.brand})`);
      console.log(`JOB_DIR=${jobDir}`);
      console.log(`Brief: ${j.brief || "none"}${j.feedback ? `\nChanges asked: ${j.feedback}` : ""}`);
      console.log(`Next: follow the brand-reel skill in that folder, then: node "${path.join(HERE, "worker.mjs")}" push "${jobDir}"`);
    } catch (e) {
      await failJob(job.id, job.payload?.reel_id, errText(e));
      throw e;
    }
  },
  // Upload out/manifest.json and send the reel to review. Safe to re-run after a fix.
  async push(args) {
    const r = await finishJob(jobDirArg(args[0]));
    console.log(`PUSHED: ${r.outputs} files, Drive ${r.drive ? "yes" : "skipped"}. The reel is in review in ARC.`);
  },
  // Give a pulled job back with a reason (it retries or shows Failed in ARC).
  async fail(args) {
    const d = jobDirArg(args[0]);
    const j = readJob(d);
    await failJob(j.job_id, j.reel_id, args.slice(1).join(" ") || "given up by the editor");
    console.log("Reported.");
  },
  // Put an already-finished video into the library (no job).
  async import(args) {
    const o = flags(args);
    if (!o.ig || !o.file || !o.title) {
      console.error('usage: import --ig <url> --file <final.mp4> --title "<title>" [--code T7] [--brand BCON] [--slug X] [--sheet s.jpg] [--note "..."]');
      process.exit(1);
    }
    const { id } = await reelApi({ action: "create", ig_url: o.ig, brand: o.brand || "BCON", title: o.title, code: o.code, note: o.note, version: Number(o.version || 1) });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "br-import-"));
    fs.mkdirSync(path.join(dir, "out"));
    const outputs = [{ kind: "final", file: path.resolve(o.file) }];
    if (o.sheet) outputs.push({ kind: "sheet", file: path.resolve(o.sheet) });
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({ reel_id: id, version: Number(o.version || 1), brand: o.brand || "BCON", code: o.code || id.slice(0, 8) }));
    fs.writeFileSync(path.join(dir, "out", "manifest.json"), JSON.stringify({ title: o.title, code: o.code, slug: o.slug, outputs }));
    await finishJob(dir);
    console.log(`IMPORTED ${o.title} -> ${id}`);
  },
  // Mid-job status for the ARC page. Run inside the job folder (or with BR_REEL_ID set).
  async progress(args) {
    const [stage, pct, ...note] = args;
    let reelId = process.env.BR_REEL_ID;
    if (!reelId && fs.existsSync("job.json")) reelId = readJob(".").reel_id;
    if (!reelId) { console.error("Run inside a job folder, or set BR_REEL_ID."); process.exit(1); }
    const r = await reelApi({ action: "progress", reel_id: reelId, stage, progress: Number(pct), note: note.join(" ") }).catch((e) => (console.error(e.message), {}));
    if (r.status === "cancelled") { console.log("CANCELLED: stop work now"); process.exit(4); }
  },
  async once() { process.exit((await claimAndRun()) ? 0 : 3); },
  async doctor() { process.exit(doctor() ? 0 : 1); },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === "loop") loop();
else if (COMMANDS[cmd]) {
  if (!SECRET) { console.error("ARC_INGEST_SECRET missing. Put it in workers/brand-reels/.env"); process.exit(1); }
  COMMANDS[cmd](rest).catch((e) => { console.error(errText(e)); process.exit(1); });
} else {
  console.error("commands: list | pull | push [dir] | fail [dir] <reason> | import ... | progress <stage> <pct> <note> | once | loop | doctor");
  process.exit(1);
}
