import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** GET /api/ops/events[?brand=<uuid>][&limit=50] — the durable ops history. */
export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));

  let q = supabaseAdmin.from("ops_events").select("*")
    .order("created_at", { ascending: false }).limit(limit);
  if (brand) q = q.eq("brand_id", brand);

  const { data, error } = await q;
  if (error) {
    if (/ops_events/.test(error.message)) {
      return NextResponse.json({ items: [], detail: "Run the 20260816000000 migration to enable ops history." });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}
