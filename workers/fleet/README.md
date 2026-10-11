# Fleet

Every machine and Claude session reports into ARC, so the hub on MAC Worker (and
`GET /api/agent/heartbeat?fleet=1`) knows what is running where.

| Machine | Slug | Role | Capabilities |
|---|---|---|---|
| BCON Main | `bcon-main` | GPU renders, ARC / Studio / EDITR sessions | `gpu,ffmpeg,blender,comfyui` |
| BCON Worker | `bcon-worker` | CPU renders, PROXe / goproxe sessions | `ffmpeg,cpu` |
| MAC Worker | `mac-worker` | Hub: briefs, alerts, routing. No renders. | — |

Schema: `supabase/migrations/20261011120000_fleet.sql`. It adds machine fields to
`agent_heartbeats`, a capability and progress to `agent_jobs`, and the `fleet_status` view.

## Session reporter (`report.mjs`)

It's a Claude Code hook. Each session reports `working`, `finished`, `needs_input`
or `ended` for its project. It has no dependencies, never blocks the session, and
always exits 0.

1. Create `~/.arc-fleet.env` on the machine:

   ```
   ARC_URL=https://arc.bconclub.com
   ARC_FLEET_SECRET=<fleet key: Vercel env ARC_FLEET_SECRET on the arc project>
   FLEET_MACHINE=bcon-main
   ```

2. Add the hooks to `~/.claude/settings.json`. Point the path at that machine's
   ARC checkout. On Windows use forward slashes, e.g. `C:/dev/builds/ARC/...`.

   ```json
   {
     "hooks": {
       "SessionStart":     [{ "hooks": [{ "type": "command", "command": "node C:/dev/builds/ARC/workers/fleet/report.mjs" }] }],
       "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node C:/dev/builds/ARC/workers/fleet/report.mjs" }] }],
       "Stop":             [{ "hooks": [{ "type": "command", "command": "node C:/dev/builds/ARC/workers/fleet/report.mjs" }] }],
       "Notification":     [{ "hooks": [{ "type": "command", "command": "node C:/dev/builds/ARC/workers/fleet/report.mjs" }] }],
       "SessionEnd":       [{ "hooks": [{ "type": "command", "command": "node C:/dev/builds/ARC/workers/fleet/report.mjs" }] }]
     }
   }
   ```

The agent name is `<machine>/session:<project folder>`, e.g. `bcon-worker/session:proxe`.
Set `FLEET_PROJECT` in the env file to override the project name.

## Jobs for a specific machine

Queue a job with `required_capability`. Only a worker that sends that capability in
`caps` to `/api/agent/next` will claim it:

```sql
insert into agent_jobs (kind, payload, required_capability)
values ('render', '{"type":"video","src":"…"}', 'gpu');
```

Workers report progress through the heartbeat:
`{ "job_id", "progress", "stage", "log_tail" }`.
