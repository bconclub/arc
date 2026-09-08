import { checkIngestAuth, authError } from "@/lib/ingest-auth";
import {
  readOutreachWorkspace,
  recordOutreachActivity,
} from "@/lib/outreach-data";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  try {
    return Response.json(await readOutreachWorkspace(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Outreach unavailable. Retry." },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  if (
    auth.agent === "unknown" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(auth.agent) ||
    auth.agent === "manual"
  )
    return Response.json(
      {
        error:
          "Supply a unique X-Agent-Name (letters, digits, hyphens or underscores).",
      },
      { status: 400 },
    );
  return recordOutreachActivity(await req.json().catch(() => null), auth.agent);
}
