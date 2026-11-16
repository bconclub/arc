#!/usr/bin/env node
// Upload review copies (720p) to Cloudflare R2 for Studio Review, or remove them.
//
//   node scripts/review-upload.mjs upload <manifest.json>   -> writes <manifest>.uploaded.json
//   node scripts/review-upload.mjs delete <r2-key> [...]
//
// Manifest: { "brand": "windchasers", "product": "p1-ads",
//             "files": [{ "code": "P03", "variant": "Devi voice", "fmt": "9x16", "path": "C:/.../file.mp4" }] }
// Keys come out as <brand>/<product>/<code>/<fmt>[-<variant>].<ext>, so a re-upload replaces the old copy.
// Only review copies go here. The 1080p masters go to Drive once an ad is live.
//
// Env (or .env.local): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import { createHash, createHmac } from "crypto"
import { existsSync, readFileSync, statSync, writeFileSync } from "fs"
import { basename, extname } from "path"

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(R2_[A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}
const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env
if (!account || !id || !secret || !bucket) {
  console.error("Missing R2 settings. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in .env.local.")
  process.exit(1)
}

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
const hmac = (k, s) => createHmac("sha256", k).update(s).digest()
function presign(key, method, expires = 900) {
  const host = `${account}.r2.cloudflarestorage.com`
  const t = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""), day = t.slice(0, 8)
  const scope = `${day}/auto/s3/aws4_request`
  const path = "/" + [bucket, ...key.split("/")].map(enc).join("/")
  const q = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${id}/${scope}`, "X-Amz-Date": t, "X-Amz-Expires": String(expires), "X-Amz-SignedHeaders": "host" }
  const qs = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join("&")
  const canonical = [method, path, qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n")
  const toSign = ["AWS4-HMAC-SHA256", t, scope, createHash("sha256").update(canonical).digest("hex")].join("\n")
  const sig = createHmac("sha256", hmac(hmac(hmac(hmac("AWS4" + secret, day), "auto"), "s3"), "aws4_request")).update(toSign).digest("hex")
  return `https://${host}${path}?${qs}&X-Amz-Signature=${sig}`
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const TYPES = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" }

const [cmd, ...args] = process.argv.slice(2)
if (cmd === "upload" && args[0]) {
  const m = JSON.parse(readFileSync(args[0], "utf8"))
  const out = []
  for (const f of m.files) {
    const ext = extname(f.path).toLowerCase()
    if (!TYPES[ext]) { console.error("skip, not a video or image:", f.path); continue }
    const key = [slug(m.brand), slug(m.product), slug(f.code), `${f.fmt}${f.variant ? "-" + slug(f.variant) : ""}${ext}`].join("/")
    const bytes = statSync(f.path).size
    const r = await fetch(presign(key, "PUT"), { method: "PUT", body: readFileSync(f.path), headers: { "Content-Type": TYPES[ext] } })
    if (!r.ok) { console.error("FAIL", basename(f.path), r.status, (await r.text()).slice(0, 200)); continue }
    console.log("ok", key, (bytes / 1048576).toFixed(1) + " MB")
    out.push({ ...f, key, bytes, kind: ext === ".mp4" ? "video" : "image" })
  }
  writeFileSync(args[0].replace(/\.json$/, "") + ".uploaded.json", JSON.stringify({ ...m, files: out }, null, 1))
  console.log(`${out.length} of ${m.files.length} uploaded, ${(out.reduce((n, f) => n + f.bytes, 0) / 1048576).toFixed(0)} MB`)
} else if (cmd === "delete" && args.length) {
  for (const key of args) {
    const r = await fetch(presign(key, "DELETE"), { method: "DELETE" })
    console.log(r.ok || r.status === 404 ? "removed" : `FAIL ${r.status}`, key)
  }
} else {
  console.error("Usage: review-upload.mjs upload <manifest.json> | delete <key> [...]")
  process.exit(1)
}
