import { NextRequest, NextResponse } from "next/server";
import { listen, listKeywords } from "@/lib/market";
import { readContext } from "@/lib/arc/agent-context";
import type { ConnectionProbe } from "@/types/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET  — last keyword bank + last probe (from agent_context), no network.
 * POST — test connections, score keywords against the listening set.
 *        { liveWeb?: boolean } spends Tavily credits on ICP queries.
 */
export async function GET() {
  const keywords = await listKeywords();
  const ctx = await readContext({ namespaces: ["market"] });
  const last = !("error" in ctx)
    ? (ctx.blocks.find((b) => b.namespace === "market")?.payload?.connections as ConnectionProbe[] | undefined)
    : undefined;
  if ("error" in keywords) {
    return NextResponse.json({ error: keywords.error, rows: [], connections: last ?? [] });
  }
  return NextResponse.json({ rows: keywords.rows, connections: last ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await listen({
    liveWeb: body.liveWeb === true,
    testConnections: body.testConnections !== false,
  });
  if (result.error) {
    return NextResponse.json(result, { status: /migration/i.test(result.error) ? 200 : 500 });
  }
  const keywords = await listKeywords();
  return NextResponse.json({
    ...result,
    rows: "rows" in keywords ? keywords.rows : [],
  });
}
