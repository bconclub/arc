import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
export async function callSession() {
  try {
    return await verifySessionToken(cookies().get(COOKIE_NAME)?.value);
  } catch {
    return false;
  }
}
export const BDR_AGENTS: Record<string, string> = {
  agent_9901m0sn70f1ejn84enhccrns2kt: "Intro DM",
  agent_8901m0sn6y14eegsqh7mmgdswm92: "Intro Cold",
  agent_1201m0sn71mvf3arwzfwv4h9s2v1: "Follow-up",
};
export const TEST_PHONE = "9731660933";
// Use ARC's existing dial-service credential. ElevenLabs secrets stay in BDR.
export function callProvider(path: string) {
  const base = process.env.PROXE_DIAL_BASE,
    key = process.env.PROXE_DIAL_KEY;
  if (!base || !key)
    throw new Error("Call history connection is not configured.");
  const suffix = path.replace(/^conversations/, "history");
  return fetch(base.replace(/\/$/, "") + "/api/outreach-dial/" + suffix, {
    headers: { Authorization: "Bearer " + key },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
}
export async function callDetail(id: string) {
  if (!/^conv_[a-zA-Z0-9]+$/.test(id)) return null;
  const r = await callProvider("conversations/" + encodeURIComponent(id));
  if (!r.ok)
    throw new Error(
      "Could not retrieve this call. Check the BDR history connection and retry.",
    );
  const d = await r.json();
  if (!Object.hasOwn(BDR_AGENTS, d.agent_id)) return null;
  return d;
}
