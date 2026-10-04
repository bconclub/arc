import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { buildInvestorOverview } from "@/lib/investor/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// goproxe.com/pitch reads the live plan and round from here. Only what the
// pitch already shows leaves: plan progress, money collected, the round's
// public terms and how full it is. No investor, no spend, no lead detail.
const ALLOWED = new Set(["https://goproxe.com", "https://www.goproxe.com", "http://localhost:3000"]);

const numbers = unstable_cache(async () => {
  const o = await buildInvestorOverview({ role: "owner" }, 3650);
  const r = o.stake.roundInfo;
  return {
    goal: o.goal,
    sales: o.sales ? { total: o.sales.total } : null,
    stake: {
      valuation: o.stake.valuation,
      roundInfo: r
        ? { name: r.name, target: r.target, equityOffered: r.equityOffered, closesOn: r.closesOn, raised: r.raised, daysOpen: r.daysOpen, daysLeft: r.daysLeft }
        : null,
    },
  };
}, ["public-pitch"], { revalidate: 300 });

function cors(origin: string | null): Record<string, string> {
  return origin && ALLOWED.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET", Vary: "Origin" }
    : {};
}

export async function GET(req: Request) {
  const data = await numbers();
  return NextResponse.json(data, {
    headers: { ...cors(req.headers.get("origin")), "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}
