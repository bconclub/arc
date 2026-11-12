#!/usr/bin/env node
// Publishes a client market report to arc.bconclub.com/reports/<slug>, readable without a login.
//
//   node scripts/publish-report.mjs <report folder> <slug> "<title>" "<one-line description>" [cover.png]
//
// The folder holds the report's index.html, style.css, img/ and its PDF (the layout from
// EDITR/tasks/T24-amrit-slesha-ayurveda-spec-creatives/market-report). Only the images the page
// uses are copied. The page gets a phone viewport, link-preview tags for WhatsApp, noindex,
// and a PDF download button. Reports hold market data only: no fees, offers or private details.
import fs from "node:fs";
import path from "node:path";

const [src, slug, title, desc, cover] = process.argv.slice(2);
if (!src || !/^[a-z0-9-]+$/.test(slug || "") || !title || !desc) {
  console.error('usage: node scripts/publish-report.mjs <folder> <slug> "<title>" "<description>" [cover.png]');
  process.exit(1);
}
const out = path.join("public", "reports", slug);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "img"), { recursive: true });

let html = fs.readFileSync(path.join(src, "index.html"), "utf8");
const pdf = fs.readdirSync(src).find((f) => f.toLowerCase().endsWith(".pdf"));
const base = `https://arc.bconclub.com/reports/${slug}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

for (const img of new Set([...html.matchAll(/img\/[\w.\-]+/g)].map((m) => m[0]))) {
  fs.copyFileSync(path.join(src, img), path.join(out, img));
}
fs.copyFileSync(path.join(src, "style.css"), path.join(out, "style.css"));
if (pdf) fs.copyFileSync(path.join(src, pdf), path.join(out, pdf));
if (cover) fs.copyFileSync(cover, path.join(out, "cover.png"));

// Assets sit beside the page, so relative paths need the trailing slash the rewrite serves.
const head = [
  `<base href="/reports/${slug}/">`,
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  // Pages are drawn 480px wide for the PDF; on a narrower phone each one is scaled to fit.
  "<script>function fit(){const z=Math.min(1,innerWidth/480);document.querySelectorAll('.page').forEach(p=>p.style.zoom=z)}" +
    "addEventListener('DOMContentLoaded',fit);addEventListener('resize',fit)</script>",
  '<meta name="robots" content="noindex">',
  `<meta name="description" content="${esc(desc)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(desc)}">`,
  `<meta property="og:url" content="${base}">`,
  cover ? `<meta property="og:image" content="${base}/cover.png">` : "",
  '<link rel="icon" href="/bcon-icon.png">',
  "<style>@media screen{body{background:#2b2f36;display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 0 90px}" +
    ".page{box-shadow:0 6px 30px rgba(0,0,0,.35)}.dl{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9;" +
    "background:#fff;color:#111;font:700 16px/1 system-ui,sans-serif;padding:14px 22px;border-radius:99px;text-decoration:none;" +
    "box-shadow:0 4px 18px rgba(0,0,0,.35)}}@media print{.dl{display:none}}</style>",
].filter(Boolean).join("\n");
html = html.replace(/<meta charset="utf-8">/i, (m) => `${m}\n${head}`);
if (pdf) html = html.replace(/<body>/i, `<body>\n<a class="dl" href="${pdf}" download>Download PDF</a>`);
// The overflow check is for the PDF build only.
html = html.replace(/<script>\s*document\.documentElement\.dataset\.overflow[\s\S]*?<\/script>/, "");
fs.writeFileSync(path.join(out, "index.html"), html);

const files = fs.readdirSync(path.join(out, "img")).length;
console.log(`${base}  (${files} images${pdf ? ", " + pdf : ""})`);
