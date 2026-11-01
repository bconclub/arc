import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PLATFORMS = ["linkedin", "x", "instagram", "youtube", "tiktok"];

// A post pasted by hand only has its link; the id in it is what keeps re-entries
// from becoming duplicates.
function idFromUrl(url: string): string | null {
  const x = url.match(/\/status\/(\d+)/);
  if (x) return x[1];
  const li = url.match(/(?:activity|ugcPost|share)[:-](\d{10,})/);
  return li ? `urn:li:activity:${li[1]}` : null;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("social_posts")
    .select("*")
    .order("posted_at", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Upserts on (platform, external_id). Only fields sent are written, so updating the
// numbers on a post never blanks its text or date.
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!PLATFORMS.includes(body.platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
  }
  const external_id = body.external_id || (body.url ? idFromUrl(body.url) : null);
  if (!external_id) {
    return NextResponse.json({ error: "Could not read a post id from that link" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    platform: body.platform,
    external_id,
    collected_at: new Date().toISOString(),
  };
  for (const key of ["account", "url", "posted_at", "text_preview"]) {
    if (body[key]) row[key] = body[key];
  }
  for (const key of ["impressions", "likes", "comments", "shares", "clicks"]) {
    if (body[key] === "" || body[key] === null) row[key] = null;
    else if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `${key} must be a number` }, { status: 400 });
      }
      row[key] = Math.round(n);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("social_posts")
    .upsert(row, { onConflict: "platform,external_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
