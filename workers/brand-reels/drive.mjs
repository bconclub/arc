// Google Drive upload for the Brand Reels worker, as brands@bconclub.com.
//
// OAuth refresh token (from drive-auth.mjs), not a service account: a service
// account has no storage quota of its own, so it cannot put files into a folder
// in someone's My Drive. Files land in GDRIVE_BRANDS_FOLDER_ID / <path...>.
import fs from "node:fs";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
let cached = { token: null, exp: 0 };

export function driveConfigured() {
  return !!(process.env.GDRIVE_CLIENT_ID && process.env.GDRIVE_CLIENT_SECRET && process.env.GDRIVE_REFRESH_TOKEN && process.env.GDRIVE_BRANDS_FOLDER_ID);
}

async function token() {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GDRIVE_CLIENT_ID,
      client_secret: process.env.GDRIVE_CLIENT_SECRET,
      refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`drive token: ${j.error_description || j.error}`);
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function api(url, init = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`drive ${r.status}: ${j.error?.message || "error"}`);
  return j;
}

async function childFolder(parent, name) {
  const q = `'${parent}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const found = await api(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  if (found.files?.length) return found.files[0].id;
  const made = await api(`${API}/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
  });
  return made.id;
}

/** Brands/<a>/<b>/... created as needed; returns the last folder's id. */
export async function ensureFolderPath(parts) {
  let id = process.env.GDRIVE_BRANDS_FOLDER_ID;
  for (const p of parts) id = await childFolder(id, p);
  return id;
}

/** Resumable upload (handles files of any size). Returns the file's web link. */
export async function uploadFile(file, name, parent) {
  const size = fs.statSync(file).size;
  const start = await fetch(`${UPLOAD}/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", "X-Upload-Content-Length": String(size) },
    body: JSON.stringify({ name, parents: [parent] }),
  });
  if (!start.ok) throw new Error(`drive upload start ${start.status}`);
  const session = start.headers.get("location");
  const put = await fetch(session, { method: "PUT", headers: { "Content-Length": String(size) }, body: fs.readFileSync(file) });
  const j = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(`drive upload ${put.status}: ${j.error?.message || ""}`);
  return j.webViewLink || `https://drive.google.com/file/d/${j.id}/view`;
}
