// What a team login may open, per person. Each person in team_members has an
// `access` list of area keys; the owner ticks them on the Team page. Middleware
// checks every request against this, so turning an area off takes effect at once.
//
// Edge-safe (middleware imports it): no server-only imports here.
import { studioMayOpen, teamMayOpen } from "@/lib/auth";

export const AREAS = [
  {
    key: "studio",
    label: "Studio",
    desc: "Every brand board: ideas, images, scripts, visual boards, reels and client links.",
    home: "/dashboard/studio",
    mayOpen: (path: string) => studioMayOpen(path),
  },
  {
    key: "sales",
    label: "Sales",
    desc: "Their leads, calls, AI calls, Ask and the Playbook. Never deleting leads or call costs.",
    home: "/team",
    mayOpen: (path: string, method: string) => teamMayOpen(path, method),
  },
] as const;

export type Area = (typeof AREAS)[number]["key"];
const KEYS = AREAS.map((a) => a.key) as string[];

/** Keep only known area keys, once each, in AREAS order. */
export function cleanAccess(x: unknown): Area[] {
  const list = Array.isArray(x) ? x.map(String) : [];
  return KEYS.filter((k) => list.includes(k)) as Area[];
}

export function memberMayOpen(access: readonly string[], path: string, method: string): boolean {
  if (path === "/api/logout") return true;
  return AREAS.some((a) => access.includes(a.key) && a.mayOpen(path, method));
}

/** Where a person lands after signing in: their first area. */
export function homeFor(access: readonly string[]): string {
  return AREAS.find((a) => access.includes(a.key))?.home ?? "/login";
}
