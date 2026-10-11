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
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
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

async function main() {
  const env = loadEnv()
  const secret = env.ARC_FLEET_SECRET || env.ARC_INGEST_SECRET
  if (!secret || !env.FLEET_MACHINE) return

  let hook = {}
  try { hook = JSON.parse((await readStdin()) || "{}") } catch {}

  const event = hook.hook_event_name || process.argv[2] || "Stop"
  const project = (env.FLEET_PROJECT || basename(hook.cwd || process.cwd())).toLowerCase()
  // One row per machine+project: a project's sessions share a line in the fleet view.
  const agent = `${env.FLEET_MACHINE}/session:${project}`
  const note = event === "Notification" ? (hook.message || "needs input") : event

  await post(`${(env.ARC_URL || "https://arc.bconclub.com").replace(/\/$/, "")}/api/agent/heartbeat`, secret, agent, {
    machine: env.FLEET_MACHINE,
    kind: "session",
    project,
    status: STATUS[event] || "working",
    note: String(note).slice(0, 300),
    version: "fleet-report/0.1",
  })
}

main().catch(() => {}).finally(() => process.exit(0))
