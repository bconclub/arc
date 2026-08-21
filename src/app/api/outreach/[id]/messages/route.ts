import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

const CHANNELS = ["email", "linkedin", "whatsapp", "call"];

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { data, error } = await supabaseAdmin
    .from("outreach_messages").select("*")
    .eq("target_id", ctx.params.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** Logs a message by hand: a pasted reply (direction "in") or an outbound
 *  note sent outside the drafting flow. Replies flip the target to replied. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const body = await req.json();
  const direction = body.direction === "in" ? "in" : "out";

  const { data, error } = await supabaseAdmin.from("outreach_messages").insert({
    target_id: ctx.params.id,
    direction,
    channel: CHANNELS.includes(body.channel) ? body.channel : "email",
    subject: body.subject || null,
    body: body.body || null,
    sent_at: direction === "out" ? new Date().toISOString() : null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (direction === "in") {
    await supabaseAdmin.from("outreach_targets")
      .update({ status: "replied" }).eq("id", ctx.params.id)
      .in("status", ["identified", "researched", "drafted", "sent", "no_reply"]);
  }

  return NextResponse.json(data);
}
