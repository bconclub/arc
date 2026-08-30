import { NextRequest, NextResponse } from "next/server";
import { addKeyword, listKeywords, patchKeyword } from "@/lib/market";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** GET /api/icp/keywords — the ranked bank. Seeds on first read. */
export async function GET() {
  const result = await listKeywords();
  if ("error" in result) {
    const missing = /migration/i.test(result.error);
    return NextResponse.json(
      { error: result.error, rows: [] },
      { status: missing ? 200 : 500 },
    );
  }
  return NextResponse.json({ rows: result.rows });
}

/** POST /api/icp/keywords { phrase, cluster?, vertical?, intent? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.phrase !== "string") {
    return NextResponse.json({ error: "phrase required" }, { status: 400 });
  }
  const result = await addKeyword(body.phrase, {
    cluster: body.cluster,
    vertical: body.vertical,
    intent: body.intent,
    status: body.status,
    source: "manual",
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ row: result.row });
}

/** PATCH /api/icp/keywords { id, status? } */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const result = await patchKeyword(body.id, {
    status: body.status,
    cluster: body.cluster,
    vertical: body.vertical,
    intent: body.intent,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ row: result.row });
}
