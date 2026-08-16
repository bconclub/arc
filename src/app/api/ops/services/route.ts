import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * The service catalogue — 17 lines distilled from seven years of receipts, each
 * carrying a real price band (p25 / median / p75). This is what lets the project form
 * pre-fill a believable budget instead of showing a blank box.
 *
 * Returns [] rather than 500 when the table isn't there yet, so the form degrades to
 * "no picker" instead of erroring before the migration is run.
 */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("services")
    .select("*")
    .eq("active", true)
    .order("lifetime_revenue", { ascending: false });
  if (error) return NextResponse.json([], { headers: { "X-Catalogue": "unavailable" } });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("services")
    .upsert(
      {
        name: body.name,
        aliases: body.aliases || [],
        scope_md: body.scope_md || null,
        sac_code: body.sac_code || null,
        default_gst_rate: body.default_gst_rate ?? 18,
      },
      { onConflict: "name" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
