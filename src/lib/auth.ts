// Session tokens: "<expiryEpochSeconds>.<base64url HMAC-SHA256 signature>".
// Web Crypto only, no Buffer, must run in the Edge middleware runtime.

const COOKIE_NAME = "arc_session";
/** Studio-only login (social media team): sees /dashboard/studio and nothing else. */
const STUDIO_COOKIE = "arc_studio";
const SESSION_DAYS = 30;

function b64urlEncode(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function hexDecode(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function hexEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET env var.");
  return secret;
}

export async function createSessionToken(): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const key = await hmacKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(expiry)));
  return `${expiry}.${b64urlEncode(sig)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiryStr, sig] = token.split(".");
  if (!expiryStr || !sig) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const key = await hmacKey(getSecret());
  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sig),
      new TextEncoder().encode(expiryStr)
    );
  } catch {
    return false;
  }
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  const stored = process.env.DASHBOARD_PASSWORD_HASH;
  if (!stored) throw new Error("Missing DASHBOARD_PASSWORD_HASH env var.");
  return verifyHash(candidate, stored);
}

const PBKDF2_ITERATIONS = 210_000;

/** "saltHex:hashHex" for a new password — the format verifyHash reads. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${hexEncode(salt.buffer)}:${hexEncode(derived)}`;
}

/** Constant-time check of a candidate against a stored "saltHex:hashHex". */
export async function verifyHash(candidate: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = hexDecode(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(candidate),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const derivedHex = hexEncode(derived);
  // constant-time compare
  if (derivedHex.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedHex.length; i++) diff |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// ── Investor sessions ────────────────────────────────────────
// A different cookie, a different signed payload. The owner token signs only
// an expiry; this one signs "investor:<id>:<expiry>", so neither verifier can
// ever accept the other's token, and an investor cookie never opens ARC.

const INVESTOR_COOKIE = "arc_investor";
const INVESTOR_DAYS = 14;

export async function createInvestorToken(investorId: string): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + INVESTOR_DAYS * 24 * 60 * 60;
  const key = await hmacKey(getSecret());
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`investor:${investorId}:${expiry}`)
  );
  return `${investorId}.${expiry}.${b64urlEncode(sig)}`;
}

/** The investor id the token was issued to, or null if forged or expired. */
export async function verifyInvestorToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expiryStr, sig] = parts;
  const expiry = Number(expiryStr);
  if (!id || !Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return null;
  const key = await hmacKey(getSecret());
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sig),
      new TextEncoder().encode(`investor:${id}:${expiryStr}`)
    );
    return ok ? id : null;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, INVESTOR_COOKIE, INVESTOR_DAYS };

// ── Studio role ───────────────────────────────────────────────
// A second, narrower login. Its token signs "studio.<expiry>", so an owner token
// can never pass as a studio one or the other way round. Off until
// STUDIO_PASSWORD_HASH is set (node scripts/hash-password.mjs "<password>").

export { STUDIO_COOKIE };

export async function createStudioToken(): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const key = await hmacKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`studio.${expiry}`));
  return `${expiry}.${b64urlEncode(sig)}`;
}

export async function verifyStudioToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiryStr, sig] = token.split(".");
  if (!expiryStr || !sig) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const key = await hmacKey(getSecret());
  try {
    return await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), new TextEncoder().encode(`studio.${expiryStr}`));
  } catch {
    return false;
  }
}

export async function verifyStudioPassword(candidate: string): Promise<boolean> {
  const stored = process.env.STUDIO_PASSWORD_HASH;
  if (!stored) return false;
  return verifyHash(candidate, stored);
}

/** Paths a studio login may open. Everything else bounces to the Studio. */
export function studioMayOpen(pathname: string): boolean {
  return /^\/dashboard\/studio(\/|$)/.test(pathname) || /^\/api\/ops\/studio(\/|$)/.test(pathname) || pathname === "/api/logout"
}
