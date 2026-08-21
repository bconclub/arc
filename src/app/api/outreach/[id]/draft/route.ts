import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { anthropicClient, voiceContext, parseJsonBlock, scrubDashes, EMAIL_RULES, OUTREACH_MODEL } from "@/lib/outreach";
import { createDraft } from "@/lib/gmail";
import { gmailConfigured } from "@/lib/gmail";
import { recordUsage } from "@/lib/arc/usage";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** What the email is FOR, by kind. Businesses get the leak note; investors
 *  and grants get a founder update with traction, because "buy PROXe" is the
 *  wrong ask there. Citations rarely need email, but a press pitch does. */
const KIND_BRIEFS: Record<string, string> = {
  business: `GOAL: a founder-to-founder note about the leads they lose to slow replies.
The reader is a busy Indian SMB owner. Reference their business from the research.
The ask: a reply or a 15-minute call to show what PROXe catches for them.`,
  investor: `GOAL: a first-touch founder note to an investor.
Traction facts you may use: PROXe is live, first paying customers on a Rs 9,999/mo
founding plan, built solo with AI, targeting India SMB lead-response.
The ask: a short intro call. No deck attached; offer to send one.`,
  grant: `GOAL: a concise note to a grant program / incubator contact.
State what PROXe is (AI lead-response for India SMBs), stage (live, revenue),
and ask the one question in the notes or research. Slightly more formal, still plain.`,
  citation: `GOAL: a pitch to an editor or platform for a listing / profile / story.
Angle: solo founder building AI-native SaaS for India SMBs, live product, real
customers. The ask: what they need from us to list or cover PROXe.`,
};

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json().catch(() => ({}));
  const instructions: string = typeof body?.instructions === "string" ? body.instructions : "";

  const { data: target, error } = await supabaseAdmin
    .from("outreach_targets").select("*").eq("id", id).single();
  if (error || !target) return NextResponse.json({ error: "target not found" }, { status: 404 });

  const ctxVoice = await voiceContext();
  const anthropic = anthropicClient();

  const response = await anthropic.messages.create({
    model: OUTREACH_MODEL,
    max_tokens: 2000,
    system: `You write outreach emails AS this founder, in their exact voice.

WHO YOU ARE:
${ctxVoice.about_me}

STYLE GUIDE (follow exactly):
${ctxVoice.voice_style}
${EMAIL_RULES}

${KIND_BRIEFS[target.kind] ?? KIND_BRIEFS.business}

Return ONLY JSON: { "subject": "...", "body": "..." }
The body is plain text with real line breaks.`,
    messages: [{
      role: "user",
      content: `TARGET:
Name: ${target.name}
Org: ${target.org ?? ""}
Segment: ${target.segment ?? ""}, City: ${target.city ?? ""}
Website: ${target.website ?? ""}
Why them: ${target.why_them ?? ""}

RESEARCH BRIEF:
${target.research ?? "(none yet, write from why_them and keep claims minimal)"}
${instructions ? `\nEXTRA INSTRUCTIONS FROM Z:\n${instructions}` : ""}

Write the email.`,
    }],
  });
  await recordUsage(OUTREACH_MODEL, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0, "outreach-draft");

  const text = response.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const parsed = parseJsonBlock<{ subject: string; body: string }>(text);
  if (!parsed?.body) {
    return NextResponse.json({ error: "Could not parse draft", raw: text.slice(0, 300) }, { status: 502 });
  }
  const subject = scrubDashes(parsed.subject ?? "").trim();
  const emailBody = scrubDashes(parsed.body).trim();

  // Into Gmail Drafts when we can address it; the row is saved either way so
  // the draft is never lost to a Gmail hiccup.
  let gmail: { draftId: string; messageId: string; threadId: string } | null = null;
  let gmailError: string | null = null;
  if (target.email && gmailConfigured()) {
    try {
      gmail = await createDraft({ to: target.email, subject, body: emailBody });
    } catch (e) {
      gmailError = e instanceof Error ? e.message : String(e);
    }
  }

  const { data: message, error: msgErr } = await supabaseAdmin.from("outreach_messages").insert({
    target_id: id,
    direction: "out",
    channel: "email",
    subject,
    body: emailBody,
    gmail_draft_id: gmail?.draftId ?? null,
    gmail_message_id: gmail?.messageId ?? null,
    gmail_thread_id: gmail?.threadId ?? null,
  }).select().single();
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  if (["identified", "researched"].includes(target.status)) {
    await supabaseAdmin.from("outreach_targets").update({ status: "drafted" }).eq("id", id);
  }

  return NextResponse.json({
    message,
    gmail: gmail ? "drafted" : target.email ? (gmailError ? `gmail failed: ${gmailError}` : "gmail not configured") : "no email on target",
  });
}
