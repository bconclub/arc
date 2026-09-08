import { recordOutreachActivity } from "@/lib/outreach-data";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return recordOutreachActivity(await req.json().catch(() => null), "manual");
}
