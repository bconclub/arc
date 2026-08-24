import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkIngestAuth, authError } from "@/lib/ingest-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The dial path lands HERE. Machine endpoint (bearer ARC_INGEST_SECRET, same
 * contract as the other /api/agent routes) for the dialer to report a call:
 * recording, transcript, and what stage the target should move to. Matches
 * the target by id when given, else by the last-10-digits of the phone, so
 * the caller only needs the number it just dialed.
 *
 * Body: {
 *   target_id?: string,
 *   phone?: string,               // required when target_id absent
 *   transcript?: string,
 *   recording_url?: string,
 *   disposition?: "no_answer" | "callback" | "interested" | "not_interested" | "wrong_number",
 *   stage?: OutreachStatus,       // explicit stage override; else derived from disposition
 * }
 */
const DISPOSITION_STAGE: Record<string, string> = {
  interested: "replied",
  callback: "replied",
  not_interested: "lost",
  wrong_number: "lost",
  no_answer: "no_reply",
};
const STATUSES = ["identified", "researched", "drafted", "sent", "replied", "meeting", "won", "lost", "no_reply"];

export async function POST(req: NextRequest) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  let target: { id: string; status: string } | null = null;
  if (body.target_id) {
    const { data } = await supabaseAdmin
      .from("outreach_targets").select("id, status").eq("id", String(body.target_id)).maybeSingle();
    target = (data as { id: string; status: string } | null) ?? null;
  } else if (body.phone) {
    const key = String(body.phone).replace(/\D/g, "").slice(-10);
    if (key.length < 10) return NextResponse.json({ error: "valid phone or target_id required" }, { status: 400 });
    // Phones are stored free-form; match on the normalized tail.
    const { data } = await supabaseAdmin
      .from("outreach_targets").select("id, status, phone").not("phone", "is", null);
    const hit = (data ?? []).find((t) => String(t.phone).replace(/\D/g, "").slice(-10) === key);
    target = hit ? { id: String(hit.id), status: String(hit.status) } : null;
  } else {
    return NextResponse.json({ error: "target_id or phone required" }, { status: 400 });
  }
  if (!target) return NextResponse.json({ error: "target not found" }, { status: 404 });

  const transcript = typeof body.transcript === "string" ? body.transcript.slice(0, 20000) : "";
  const recording = typeof body.recording_url === "string" ? body.recording_url : "";
  const disposition = typeof body.disposition === "string" ? body.disposition : "";

  const lines = [
    disposition && `DISPOSITION: ${disposition}`,
    recording && `RECORDING: ${recording}`,
    transcript && `TRANSCRIPT:\n${transcript}`,
  ].filter(Boolean).join("\n");

  const { data: msg, error: msgErr } = await supabaseAdmin.from("outreach_messages").insert({
    target_id: target.id,
    direction: "out",
    channel: "call",
    body: lines || "(call logged, no details)",
    sent_at: new Date().toISOString(),
  }).select("id").single();
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const stage = STATUSES.includes(body.stage) ? body.stage : DISPOSITION_STAGE[disposition];
  // Never demote a target that already progressed past the calling stages.
  const DEMOTABLE = ["identified", "researched", "drafted", "sent", "no_reply"];
  if (stage && (DEMOTABLE.includes(target.status) || stage === "won" || stage === "meeting")) {
    await supabaseAdmin.from("outreach_targets").update({ status: stage }).eq("id", target.id);
  }

  return NextResponse.json({ ok: true, target_id: target.id, message_id: msg.id, stage: stage ?? null });
}
