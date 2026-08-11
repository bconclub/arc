import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Columns the dashboard is allowed to write. The `brands` table is the client
// register and also holds GST/billing fields (gstin, place_of_supply, currency,
// lifetime_revenue…), those are owned by the billing side and are deliberately
// NOT writable from here.
const WRITABLE = ["name", "logo_url", "color", "notes", "status", "kind", "via_brand_id", "aliases", "domains", "github_repos"];

export async function GET() {
  const { data, error } = await supabaseAdmin.from("brands").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const row: Record<string, unknown> = { name: String(body.name).trim() };
  for (const key of WRITABLE) {
    if (key !== "name" && key in body && body[key] !== "") row[key] = body[key];
  }

  const { data, error } = await supabaseAdmin.from("brands").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
