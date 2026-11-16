// Cloudflare R2: presigned links for the Studio Review copies.
//
// The bucket stays private. The server signs a GET link that works for a short
// while, so a copied link dies on its own. Plain AWS SigV4 query signing; R2 is
// S3-compatible, region "auto". No SDK needed.
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import { createHash, createHmac } from "crypto"

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s).digest()

export function r2Configured() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET)
}

/** A presigned URL for one object. GET to play, PUT to upload, DELETE to remove. */
export function r2Presign(key: string, opts: { method?: "GET" | "PUT" | "DELETE"; expires?: number; now?: Date } = {}) {
  const account = process.env.R2_ACCOUNT_ID!, id = process.env.R2_ACCESS_KEY_ID!
  const secret = process.env.R2_SECRET_ACCESS_KEY!, bucket = process.env.R2_BUCKET!
  const method = opts.method || "GET"
  const expires = Math.min(Math.max(opts.expires ?? 3600, 60), 604800)
  const host = `${account}.r2.cloudflarestorage.com`
  const t = (opts.now || new Date()).toISOString().replace(/[-:]|\.\d{3}/g, "")
  const day = t.slice(0, 8)
  const scope = `${day}/auto/s3/aws4_request`
  const path = "/" + [bucket, ...key.split("/")].map(enc).join("/")
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${id}/${scope}`,
    "X-Amz-Date": t,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  }
  const qs = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join("&")
  const canonical = [method, path, qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n")
  const toSign = ["AWS4-HMAC-SHA256", t, scope, sha256(canonical)].join("\n")
  const kSign = hmac(hmac(hmac(hmac("AWS4" + secret, day), "auto"), "s3"), "aws4_request")
  const sig = createHmac("sha256", kSign).update(toSign).digest("hex")
  return `https://${host}${path}?${qs}&X-Amz-Signature=${sig}`
}
