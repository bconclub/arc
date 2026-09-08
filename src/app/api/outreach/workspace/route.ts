import { readOutreachWorkspace } from "@/lib/outreach-data";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await readOutreachWorkspace(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Outreach could not load. Please retry." },
      { status: 503 },
    );
  }
}
