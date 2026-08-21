import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const KINDS = ["business", "investor", "grant", "citation"];
const STATUSES = ["identified", "researched", "drafted", "sent", "replied", "meeting", "won", "lost", "no_reply"];

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  const status = req.nextUrl.searchParams.get("status");

  let q = supabaseAdmin.from("outreach_targets").select("*").order("created_at", { ascending: false });
  if (kind && KINDS.includes(kind)) q = q.eq("kind", kind);
  if (status && STATUSES.includes(status)) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const row: Record<string, unknown> = { name: body.name };
  row.kind = KINDS.includes(body.kind) ? body.kind : "business";
  for (const key of ["org", "segment", "city", "email", "phone", "linkedin", "website", "why_them", "research", "source", "notes", "next_at"]) {
    if (key in body) row[key] = body[key] === "" ? null : body[key];
  }
  if (STATUSES.includes(body.status)) row.status = body.status;

  const { data, error } = await supabaseAdmin.from("outreach_targets").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
