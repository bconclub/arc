// The fleet: which machines exist, what each is for, and what it can run.
//
// Heartbeats (agent_heartbeats, see 20261011120000_fleet.sql) say what is alive right
// now; this says what *should* exist, so a machine that never reported still shows up
// as "never seen" instead of silently missing from the page.

export type Machine = {
  slug: string
  name: string
  role: string
  hardware: string
  capabilities: string[]
}

export const MACHINES: Machine[] = [
  {
    slug: "bcon-main",
    name: "BCON Main",
    role: "GPU renders · ARC, Studio, EDITR sessions",
    hardware: "Windows · RTX 3060 Ti · 32 GB",
    capabilities: ["gpu", "ffmpeg", "blender", "comfyui"],
  },
  {
    slug: "bcon-worker",
    name: "BCON Worker",
    role: "CPU renders · PROXe, goproxe sessions",
    hardware: "Windows · ~16 GB",
    capabilities: ["ffmpeg", "cpu"],
  },
  {
    slug: "mac-worker",
    name: "MAC Worker",
    role: "Hub · briefs, alerts, routes messages",
    hardware: "macOS · terminal only · always awake",
    capabilities: [],
  },
]

// What the control center can queue. `render` jobs go to whichever machine has the
// capability; `hub_message` is picked up by the hub on MAC Worker and delivered to the
// named Claude session (SendMessage), which wakes it if idle.
export const JOB_TYPES = [
  { value: "video", label: "Video render", kind: "render", capability: "ffmpeg" },
  { value: "ai-image", label: "AI image", kind: "render", capability: "comfyui" },
  { value: "blender", label: "Blender render", kind: "render", capability: "blender" },
  { value: "gpu", label: "Any GPU job", kind: "render", capability: "gpu" },
  { value: "claude", label: "Claude task (headless)", kind: "claude_task", capability: null },
] as const

export const HUB_MESSAGE = "hub_message"
