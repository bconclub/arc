import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PROXe signals feed for the ARC fortress frontend.
 *
 * GET  /api/proxe/briefs?kind=brief&brand=&limit=  -> list, newest first (dashboard reads this)
 * POST /api/proxe/briefs                            -> ingest one signal (the VPS generator calls this)
 *
 * Ingest auth: Authorization: Bearer $ARC_INGEST_SECRET. Fail-closed — no secret,
 * no writes. Reads are open (the ARC dashboard is password-gated at the app layer).
 */

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "brief";
  const brand = sp.get("brand");
  const limit = Math.min(parseInt(sp.get("limit") || "60", 10) || 60, 200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabaseAdmin as any)
    .from("arc_briefs")
    .select("id, kind, brand, brief_date, title, body_md, totals, source, created_at")
    .eq("kind", kind)
    .order("brief_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (brand) q = q.eq("brand", brand);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const secret = process.env.ARC_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ingest disabled (no ARC_INGEST_SECRET)" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    kind?: string; brand?: string; brief_date?: string;
    title?: string; body_md?: string; totals?: Record<string, unknown>; source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.brand || !body.brief_date || !body.title) {
    return NextResponse.json({ error: "brand, brief_date, title required" }, { status: 400 });
  }

  const row = {
    kind: body.kind || "brief",
    brand: body.brand,
    brief_date: body.brief_date,
    title: body.title,
    body_md: body.body_md || "",
    totals: body.totals || {},
    source: body.source || "daily-brief",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from("arc_briefs")
    .upsert(row, { onConflict: "kind,brand,brief_date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
