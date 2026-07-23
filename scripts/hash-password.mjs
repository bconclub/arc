#!/usr/bin/env node
// Generates a DASHBOARD_PASSWORD_HASH value for .env.local / Vercel env vars.
// Usage: node scripts/hash-password.mjs "your password"
import { randomBytes, pbkdf2Sync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your password"');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 210_000, 32, "sha256");
console.log(`${salt.toString("hex")}:${hash.toString("hex")}`);
