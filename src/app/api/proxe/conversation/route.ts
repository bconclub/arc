// PROXe reports a conversation event onto the ARC outreach board.
//
// This is the inbound twin of WhatsApp send: ARC handed the prospect to PROXe
// on first outbound, PROXe owns the thread after two-way contact, and this
// call keeps the outreach row honest so the two systems stay intertwined.
//
// POST /api/proxe/conversation
// Authorization: Bearer $ARC_INGEST_SECRET
// {
//   target_id?, phone?,                 // one required
//   channel?: "whatsapp" | "instagram" | "web" | "email" | "call" | "voice",
//   direction?: "in" | "out",
//   text?, from_name?, org?, segment?,
//   conversation_id?,
//   two_way?: boolean,                  // first prospect reply
//   stage?: OutreachStatus
// }
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkIngestAuth, authError } from "@/lib/ingest-auth";
import {
  coerceChannel,
  findOutreachTarget,
  isOutreachStatus,
  last10,
} from "@/lib/outreach-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMOTABLE = ["identified", "researched", "drafted", "sent", "no_reply"];

export async function POST(req: NextRequest) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const phone = typeof body.phone === "string" ? body.phone : "";
  const targetId = typeof body.target_id === "string" ? body.target_id : "";
  if (!targetId && last10(phone).length < 10) {
    return NextResponse.json({ error: "target_id or a valid phone is required" }, { status: 400 });
  }

  let target = await findOutreachTarget({
    target_id: targetId || undefined,
    phone: phone || undefined,
  });

  const created = !target;
  if (!target) {
    const key = last10(phone);
    const fromName = typeof body.from_name === "string" ? body.from_name.trim() : "";
    const { data, error } = await supabaseAdmin
      .from("outreach_targets")
      .insert({
        kind: "business",
        name: fromName || `PROXe ${key.slice(-4)}`,
        org: typeof body.org === "string" ? body.org : null,
        segment: typeof body.segment === "string" ? body.segment : null,
        phone,
        why_them: "Inbound from PROXe.",
        source: "proxe",
        status: body.direction === "out" ? "sent" : "replied",
      })
      .select("id, status, phone, name")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || "could not create target" }, { status: 500 });
    }
    target = data;
  }

  const direction = body.direction === "out" ? "out" : "in";
  const channel = coerceChannel(body.channel);
  const text = typeof body.text === "string" ? body.text.slice(0, 20000) : "";
  const conv = typeof body.conversation_id === "string" ? body.conversation_id : "";

  const lines = [
    conv && `CONVERSATION: ${conv}`,
    text || "(PROXe event, no text)",
  ].filter(Boolean).join("\n");

  const { data: recent } = await supabaseAdmin
    .from("outreach_messages")
    .select("id, body, created_at")
    .eq("target_id", target.id)
    .eq("direction", direction)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recentBody = recent && typeof recent.body === "string" ? recent.body : "";
  const recentAt = recent?.created_at ? new Date(String(recent.created_at)).getTime() : 0;
  const dup = recentBody === lines && Date.now() - recentAt < 5 * 60_000;

  let messageId: string | null = dup ? String(recent!.id) : null;
  if (!dup) {
    const { data: msg, error: msgErr } = await supabaseAdmin
      .from("outreach_messages")
      .insert({
        target_id: target.id,
        direction,
        channel,
        body: lines,
        sent_at: direction === "out" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });
    messageId = msg.id;
  }

  const twoWay = body.two_way === true || direction === "in";
  const stage = isOutreachStatus(body.stage)
    ? body.stage
    : twoWay
      ? "replied"
      : direction === "out"
        ? "sent"
        : null;

  if (stage && (DEMOTABLE.includes(target.status) || stage === "won" || stage === "meeting")) {
    await supabaseAdmin.from("outreach_targets").update({ status: stage }).eq("id", target.id);
  }

  return NextResponse.json({
    ok: true,
    target_id: target.id,
    message_id: messageId,
    created,
    duplicate: dup,
    stage: stage ?? target.status,
  });
}
