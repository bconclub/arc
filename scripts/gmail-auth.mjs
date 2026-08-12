#!/usr/bin/env node
/**
 * One-time Gmail authorisation for ARC.
 *
 *   node scripts/gmail-auth.mjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * or, if GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are already in .env.local:
 *
 *   node scripts/gmail-auth.mjs
 *
 * Google will not issue a Gmail refresh token to gcloud's built-in client:
 * gmail.readonly is a restricted scope, and `gcloud auth application-default
 * login --scopes=...gmail...` fails with "you must provide your own client ID".
 * So the OAuth client has to be yours, and this script runs the installed-app
 * flow against it: open the consent page, catch the redirect on localhost,
 * exchange the code, and write the refresh token back into .env.local.
 *
 * Read-only scope. ARC never sends, labels, moves or deletes mail.
 */
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";

const ENV_PATH = new URL("../.env.local", import.meta.url);
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const PORT = 4571;
const REDIRECT = `http://localhost:${PORT}`;

function readEnv() {
  const out = {};
  try {
    for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch { /* no env file yet */ }
  return out;
}

/** Rewrites one key in place, appending it when absent, leaving the rest alone. */
function writeEnv(key, value) {
  let text = "";
  try { text = fs.readFileSync(ENV_PATH, "utf8"); } catch { /* create it */ }
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text)
    ? text.replace(re, line)
    : (text.endsWith("\n") || text === "" ? text : text + "\n") + line + "\n";
  fs.writeFileSync(ENV_PATH, text, { mode: 0o600 });
}

async function main() {
  const env = readEnv();
  const clientId = process.argv[2] || env.GMAIL_CLIENT_ID;
  const clientSecret = process.argv[3] || env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Need a client id and secret.\n\n" +
      "  1. https://console.cloud.google.com/apis/credentials\n" +
      "  2. Create credentials, OAuth client ID, application type Desktop app\n" +
      "  3. node scripts/gmail-auth.mjs <CLIENT_ID> <CLIENT_SECRET>\n\n" +
      "Also enable the Gmail API:\n" +
      "  https://console.cloud.google.com/apis/library/gmail.googleapis.com",
    );
    process.exit(1);
  }

  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // Without both of these Google returns an access token only, and the whole
    // point here is the refresh token.
    access_type: "offline",
    prompt: "consent",
  });

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const q = new URL(req.url, REDIRECT).searchParams;
      const err = q.get("error");
      const got = q.get("code");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<body style="font-family:system-ui;padding:3rem;text-align:center">
           <h2>${err ? "Authorisation refused" : "Authorised"}</h2>
           <p>${err ? err : "You can close this tab and go back to the terminal."}</p>
         </body>`,
      );
      server.close();
      err ? reject(new Error(err)) : resolve(got);
    });
    server.listen(PORT, () => {
      console.log(`\nOpening the consent page. If nothing opens, paste this:\n\n${url}\n`);
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    });
    // Without a timeout an abandoned flow leaves the port held open forever.
    setTimeout(() => { server.close(); reject(new Error("Timed out after 5 minutes.")); }, 300_000);
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.refresh_token) {
    console.error("Token exchange failed:", json.error_description ?? json.error ?? JSON.stringify(json));
    if (res.ok && !json.refresh_token) {
      console.error("Google returned no refresh token. Revoke ARC's access at " +
        "https://myaccount.google.com/permissions and run this again.");
    }
    process.exit(1);
  }

  writeEnv("GMAIL_CLIENT_ID", clientId);
  writeEnv("GMAIL_CLIENT_SECRET", clientSecret);
  writeEnv("GMAIL_REFRESH_TOKEN", json.refresh_token);

  // Prove it works now rather than letting the first real scan discover it.
  const check = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const profile = await check.json();

  console.log("\nDone. Written to .env.local:");
  console.log("  GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN");
  if (check.ok) {
    console.log(`\nConnected to ${profile.emailAddress} (${profile.messagesTotal} messages).`);
  } else {
    console.log("\nToken saved, but the profile check failed:", profile?.error?.message ?? check.status);
  }
  console.log(
    "\nRestart the dev server so it picks up the new variables, then open Mail and press Sync.\n" +
    "For production, add the same three variables in Vercel.\n\n" +
    "Note: if the OAuth consent screen is in Testing mode, Google expires this refresh\n" +
    "token after 7 days. Publish the app, or set it to Internal, to keep it working.",
  );
}

main().catch((e) => { console.error(e.message); process.exit(1); });
