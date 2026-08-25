import { draftScriptsForApproved } from "@/lib/arc/scripts";

export const maxDuration = 300;

export async function POST() {
  const { processed, scripts_created } = await draftScriptsForApproved(8);
  return Response.json({ processed, scripts_created });
}
