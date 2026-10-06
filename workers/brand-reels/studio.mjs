#!/usr/bin/env node
/**
 * Studio CLI: an editor's side of ARC > Studio. Same .env as worker.mjs.
 *
 *   node studio.mjs inbox                        open requests across every brand (poll this)
 *   node studio.mjs brands                       brands with mood + palette
 *   node studio.mjs brand <slug>                 one brand: brief, mood, board summary
 *   node studio.mjs take <request-id>            mark a request as yours (doing)
 *   node studio.mjs done <request-id> ["note"]   close it, with what you delivered
 *   node studio.mjs images <slug> <file...> [--title T] [--prompt P] [--for <request-id>] [--source gpt|asset|frame] [--hidden 1]
 *   node studio.mjs idea <slug> "<title>" ["<body>"]
 *   node studio.mjs note <slug> "<title>" ["<body>"]
 *   node studio.mjs request <slug> "<title>" ["<body>"]
 *   node studio.mjs hide <item-id> | show <item-id>   keep an idea/image off (or on) the client board
 *   node studio.mjs set <slug> [--name N] [--mood M] [--palette "#hex #hex"] [--brief-file F] [--site U] [--ig H] [--drive U] [--logo file] [--status S]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of (fs.existsSync(path.join(HERE, ".env")) ? fs.readFileSync(path.join(HERE, ".env"), "utf8") : "").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const ARC_URL = (process.env.ARC_URL || "https://arc.bconclub.com").replace(/\/$/, "");
const SECRET = process.env.ARC_INGEST_SECRET || "";
const AGENT = process.env.AGENT_NAME || "editor";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function netFetch(url, init, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fetch(url, init); } catch (e) { if (i >= tries) throw e; await sleep(1000 * i * i); }
  }
}
async function api(body) {
  const r = await netFetch(`${ARC_URL}/api/agent/studio`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "x-agent-name": AGENT, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${body.action} ${r.status}: ${j.error || "no body"}`);
  return j;
}
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
async function upload(slug, file) {
  const { path: p, signedUrl } = await api({ action: "upload_url", slug, name: path.basename(file) });
  const r = await netFetch(signedUrl, { method: "PUT", headers: { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" }, body: fs.readFileSync(file) });
  if (!r.ok) throw new Error(`upload ${path.basename(file)} ${r.status}`);
  return p;
}
function parse(args) {
  const o = {}; const pos = [];
  for (let i = 0; i < args.length; i++) args[i].startsWith("--") ? (o[args[i].slice(2)] = args[++i]) : pos.push(args[i]);
  return { o, pos };
}

const C = {
  async inbox() {
    const { requests } = await api({ action: "inbox" });
    if (!requests.length) return console.log("Inbox empty.");
    for (const r of requests) {
      console.log(`[${r.status}] ${r.id}  ${r.studio_brands?.name}: ${r.title || ""}${r.assignee ? `  (${r.assignee})` : ""}`);
      if (r.body) console.log(`    ${r.body.replace(/\n/g, "\n    ")}`);
    }
  },
  async brands() {
    const { brands } = await api({ action: "brands" });
    for (const b of brands) console.log(`${b.slug.padEnd(14)} ${b.status.padEnd(8)} ${b.palette.join(" ").padEnd(30)} ${b.mood || ""}`);
  },
  async brand([slug]) {
    const { brand, items } = await api({ action: "brand", slug });
    console.log(`# ${brand.name} (${brand.status})\nMood: ${brand.mood || "-"}\nPalette: ${brand.palette.join(" ") || "-"}\nSite: ${brand.site_url || "-"}  IG: ${brand.instagram || "-"}  Drive: ${brand.drive_url || "-"}\n`);
    if (brand.brief) console.log(brand.brief + "\n");
    const by = (k) => items.filter((i) => i.kind === k);
    console.log(`Board: ${by("image").length} images, ${by("idea").length} ideas, ${by("request").length} requests, ${by("note").length} notes`);
    const pick = (i) => {
      const l = (i.votes || []).filter((v) => v.choice === "like").length, p = (i.votes || []).filter((v) => v.choice === "pass").length;
      const notes = (i.votes || []).filter((v) => v.comment).map((v) => `${v.voter}: ${v.comment}`);
      return (l || p ? `  [client: ${l} love, ${p} pass]` : "") + (i.hidden ? "  [hidden]" : "") + (notes.length ? "\n      " + notes.join("\n      ") : "");
    };
    for (const i of [...by("request"), ...by("idea"), ...by("note")]) console.log(`  ${i.kind.padEnd(7)} [${i.status}] ${i.id}  ${i.title || ""}${pick(i)}`);
    const loved = by("image").filter((i) => (i.votes || []).some((v) => v.choice === "like"));
    if (loved.length) { console.log("\nImages the client loved:"); for (const i of loved) console.log(`  ${i.id}  ${i.title || ""}${pick(i)}`); }
    console.log(`\nClient board: ${brand.share_enabled ? "shared" : "not shared"}`);
  },
  async take([id]) { await api({ action: "take", id }); console.log("Taken."); },
  async done([id, ...note]) {
    await api({ action: "update", id, status: "done", ...(note.length ? { body: note.join(" ") } : {}) });
    console.log("Done.");
  },
  async images(args) {
    const { o, pos } = parse(args);
    const [slug, ...files] = pos;
    if (!slug || !files.length) throw new Error("usage: images <slug> <file...> [--title T] [--prompt P] [--for <request-id>] [--source gpt]");
    for (const f of files) {
      const image_path = await upload(slug, f);
      await api({ action: "add", slug, kind: "image", image_path, title: o.title || path.basename(f).replace(/\.[^.]+$/, ""), prompt: o.prompt, source: o.source || (o.prompt ? "gpt" : "editor"), parent_id: o.for, ...(o.hidden ? { hidden: true } : {}) });
      console.log("added", path.basename(f));
    }
  },
  async hide([id]) { await api({ action: "update", id, hidden: true }); console.log("Hidden from the client board."); },
  async show([id]) { await api({ action: "update", id, hidden: false }); console.log("Shown on the client board."); },
  async idea([slug, title, body]) { console.log((await api({ action: "add", slug, kind: "idea", title, body })).id); },
  async note([slug, title, body]) { console.log((await api({ action: "add", slug, kind: "note", title, body })).id); },
  async request([slug, title, body]) { console.log((await api({ action: "add", slug, kind: "request", title, body })).id); },
  async set(args) {
    const { o, pos } = parse(args);
    const [slug] = pos;
    if (!slug) throw new Error("usage: set <slug> [--name N] [--mood M] [--palette ...] [--brief-file F] [--site U] [--ig H] [--drive U] [--logo file] [--status S]");
    const body = { action: "upsert_brand", slug, name: o.name };
    if (o.mood) body.mood = o.mood;
    if (o.palette) body.palette = o.palette;
    if (o["brief-file"]) body.brief = fs.readFileSync(o["brief-file"], "utf8");
    if (o.site) body.site_url = o.site;
    if (o.ig) body.instagram = o.ig;
    if (o.drive) body.drive_url = o.drive;
    if (o.status) body.status = o.status;
    const first = await api(body);
    if (o.logo) await api({ action: "upsert_brand", slug, logo_path: await upload(slug, o.logo) });
    console.log(first.created ? `created ${slug}` : `updated ${slug}`);
  },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!C[cmd]) { console.error("commands: " + Object.keys(C).join(" | ")); process.exit(1); }
if (!SECRET) { console.error("ARC_INGEST_SECRET missing (workers/brand-reels/.env)"); process.exit(1); }
C[cmd](rest).catch((e) => { console.error(e.message); process.exit(1); });
