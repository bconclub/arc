#!/usr/bin/env node
/**
 * One-time Drive authorisation for the Brand Reels worker. Run on the Mac:
 *
 *   node drive-auth.mjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * Use the same Google Cloud OAuth client as ARC's Gmail (Desktop app type), with
 * the Drive API enabled on that project. Sign in as brands@bconclub.com when the
 * browser opens. Writes GDRIVE_CLIENT_ID / SECRET / REFRESH_TOKEN into .env here.
 *
 * Scope is full `drive`: the files go into the existing shared Brands folder,
 * which `drive.file` (app-created files only) cannot write into.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ENV = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
const PORT = 4572;
const REDIRECT = `http://localhost:${PORT}`;
const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) { console.error("usage: node drive-auth.mjs <CLIENT_ID> <CLIENT_SECRET>"); process.exit(1); }

function writeEnv(key, value) {
  let text = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text) ? text.replace(re, `${key}=${value}`) : (text && !text.endsWith("\n") ? text + "\n" : text) + `${key}=${value}\n`;
  fs.writeFileSync(ENV, text, { mode: 0o600 });
}

const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
auth.search = new URLSearchParams({
  client_id: clientId, redirect_uri: REDIRECT, response_type: "code",
  scope: "https://www.googleapis.com/auth/drive", access_type: "offline", prompt: "consent",
  login_hint: "brands@bconclub.com",
}).toString();

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) { res.end("No code in the redirect."); return; }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!j.refresh_token) { res.end("No refresh token returned: " + (j.error_description || j.error)); console.error(j); process.exit(1); }
  writeEnv("GDRIVE_CLIENT_ID", clientId);
  writeEnv("GDRIVE_CLIENT_SECRET", clientSecret);
  writeEnv("GDRIVE_REFRESH_TOKEN", j.refresh_token);
  res.end("Drive connected. You can close this tab.");
  console.log("Saved GDRIVE_* to", ENV);
  server.close();
});
server.listen(PORT, () => {
  console.log("Opening Google consent. If it does not open, visit:\n" + auth);
  spawn("open", [auth.toString()], { stdio: "ignore" }).on("error", () => {});
});
