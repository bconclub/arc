#!/usr/bin/env node
// Fleet reporter: a Claude Code hook that tells ARC what this session is doing, so
// the hub (MAC Worker) and the fleet view see every session on every machine.
//
// Wire it in ~/.claude/settings.json on each machine (see README.md here):
//   SessionStart / UserPromptSubmit -> working,  Stop -> finished,
//   Notification -> needs_input,                 SessionEnd -> ended
//
// Config comes from env or ~/.arc-fleet.env (KEY=value lines):
//   ARC_URL, ARC_FLEET_SECRET, FLEET_MACHINE (bcon-main | bcon-worker | mac-worker)
//
// It must never get in the way of the session: no deps (old Mac node is fine), a
// 4s cap on the request, and it always exits 0.
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import https from "node:https"
import http from "node:http"

const STATUS = {
  SessionStart: "working",
  UserPromptSubmit: "working",
  Stop: "finished",
  Notification: "needs_input",
  SessionEnd: "ended",
}

function loadEnv() {
  const env = { ...process.env }
  try {
    for (const line of readFileSync(join(homedir(), ".arc-fleet.env"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {}
  return env
}

function readStdin() {
  return new Promise((resolve) => {
    let s = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (d) => (s += d))
    process.stdin.on("end", () => resolve(s))
    setTimeout(() => resolve(s), 1000)
  })
}

function post(url, secret, agent, body) {
  return new Promise((resolve) => {
    const u = new URL(url)
    const data = JSON.stringify(body)
    const req = (u.protocol === "http:" ? http : https).request(
      u,
      {
        method: "POST",
        timeout: 4000,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(data),
          authorization: `Bearer ${secret}`,
          "x-agent-name": agent,
        },
      },
      (res) => { res.resume(); res.on("end", resolve) }
    )
    req.on("timeout", () => req.destroy())
    req.on("error", resolve)
    req.end(data)
  })
}

/** The project a session is in: the nearest folder holding .git, else the folder itself. */
function projectOf(cwd) {
  let dir = cwd
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, ".git")) && !/[\\/]\.claude[\\/]/.test(dir)) return basename(dir)
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  return basename(cwd)
}

/** First line of what was asked, tidied: the session's current task. */
const firstLine = (t) =>
  String(t || "").replace(/<[^>]+>/g, " ").split(/\r?\n/).map((l) => l.trim()).find(Boolean)?.slice(0, 200) || ""

/** The session's latest reply, from the end of its transcript (last 256 KB only). */
function lastSaid(path) {
  try {
    if (!path || !existsSync(path)) return ""
    const size = statSync(path).size, len = Math.min(size, 262144)
    const buf = Buffer.alloc(len), fd = openSync(path, "r")
    readSync(fd, buf, 0, len, size - len); closeSync(fd)
    for (const l of buf.toString("utf8").split("\n").reverse()) {
      try {
        const m = JSON.parse(l)
        if (m.type !== "assistant") continue
        const text = (m.message?.content || []).filter((c) => c.type === "text").map((c) => c.text).join(" ")
        if (text.trim()) return text.replace(/\s+/g, " ").trim().slice(0, 240)
      } catch {}
    }
  } catch {}
  return ""
}

async function main() {
  const env = loadEnv()
  const secret = env.ARC_FLEET_SECRET || env.ARC_INGEST_SECRET
  if (!secret || !env.FLEET_MACHINE) return

  let hook = {}
  try { hook = JSON.parse((await readStdin()) || "{}") } catch {}

  const event = hook.hook_event_name || process.argv[2] || "Stop"
  const project = (env.FLEET_PROJECT || projectOf(hook.cwd || process.cwd())).toLowerCase()
  // One row per session, so two sessions in the same project show separately.
  const sid = String(hook.session_id || "").slice(0, 6)
  const agent = `${env.FLEET_MACHINE}/session:${project}${sid ? "#" + sid : ""}`
  const note = event === "Notification" ? (hook.message || "needs input")
    : event === "Stop" ? "finished its turn" : event === "SessionEnd" ? "session closed" : "working"
  const extra = {}
  if (event === "UserPromptSubmit" && hook.prompt) extra.task = firstLine(hook.prompt)
  if (event === "Stop" || event === "Notification") { const said = lastSaid(hook.transcript_path); if (said) extra.last_said = said }

  await post(`${(env.ARC_URL || "https://arc.bconclub.com").replace(/\/$/, "")}/api/agent/heartbeat`, secret, agent, {
    machine: env.FLEET_MACHINE,
    kind: "session",
    project,
    status: STATUS[event] || "working",
    note: String(note).slice(0, 300),
    version: "fleet-report/0.2",
    ...extra,
  })
}

main().catch(() => {}).finally(() => process.exit(0))
