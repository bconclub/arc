import Anthropic from "@anthropic-ai/sdk";
import { HAIKU } from "@/lib/llm/models";
import { recordUsage } from "@/lib/arc/usage";
import { getPlaybook, getViewer, tdb, unauthorized } from "@/lib/team";

/**
 * "Ask": the team's onboarding assistant. Answers questions about PROXe, BCON,
 * the sales process and how to use ARC, from the owner's playbook only, and
 * knows the asker's own tasks and lead counts. A member's thread is kept so it
 * reads like one ongoing conversation; the owner can try it out (not stored).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.ANTHROPIC_BASE_URL;

const HISTORY = 20;

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "team") return Response.json({ messages: [] });
  const { data } = await tdb.from("team_chat").select("id,role,content,created_at")
    .eq("member_id", viewer.member.id).order("created_at", { ascending: false }).limit(60);
  return Response.json({ messages: (data || []).reverse() });
}

async function context(memberId: string | null) {
  if (!memberId) return "The person asking is the owner, trying the assistant out.";
  const today = new Date().toISOString().slice(0, 10);
  const [tasks, leads] = await Promise.all([
    tdb.from("team_tasks").select("title,status,due_on").eq("member_id", memberId).neq("status", "done").limit(30),
    tdb.from("outreach_targets").select("status,next_at,source").eq("owner_id", memberId),
  ]);
  type Lead = { status: string; next_at: string | null; source: string | null };
  const mine = (leads.data || []) as Lead[];
  const open = mine.filter((l) => !["won", "lost"].includes(l.status));
  const due = open.filter((l) => l.next_at && l.next_at.slice(0, 10) <= today).length;
  const t = ((tasks.data || []) as { title: string; status: string; due_on: string | null }[])
    .map((x) => `- ${x.title} (${x.status}${x.due_on ? `, due ${x.due_on}` : ""})`).join("\n");
  return [
    `Today is ${today}.`,
    `Their open tasks:\n${t || "- none"}`,
    `Their leads: ${mine.length} assigned, ${open.length} open, ${due} follow-ups due today or overdue, ${open.filter((l) => l.source === "proxe_inbound").length} of the open ones are inbound.`,
  ].join("\n");
}

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, 4000);
  if (!text) return Response.json({ error: "Type a question first." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "The assistant isn't connected yet (no ANTHROPIC_API_KEY)." }, { status: 503 });

  const memberId = viewer.kind === "team" ? viewer.member.id : null;
  const name = viewer.kind === "team" ? viewer.member.name : "Owner";
  let history: { role: "user" | "assistant"; content: string }[] = [];
  if (memberId) {
    const { data } = await tdb.from("team_chat").select("role,content").eq("member_id", memberId)
      .order("created_at", { ascending: false }).limit(HISTORY);
    history = (data || []).reverse();
  } else if (Array.isArray(b.history)) {
    history = b.history.slice(-HISTORY).filter((m: { role: string; content: string }) => ["user", "assistant"].includes(m.role) && typeof m.content === "string");
  }

  const [{ text: playbook }, ctx] = await Promise.all([getPlaybook(), context(memberId)]);
  const system = `You are the onboarding and sales assistant inside ARC for BCON's sales team. You are talking to ${name}, who handles inbound leads and makes outbound calls for PROXe.

Answer from the PLAYBOOK below. It is the only source of facts about PROXe, BCON, prices, plans, offers, policies and the sales process. If the playbook does not cover something (a price, a feature, a promise to a customer), say plainly that it isn't in the playbook and that they should ask Z (the founder) before telling a customer. Never invent prices, discounts, features, timelines, guarantees or certifications.

You can also coach: how to open a call, handle an objection, follow up, write a short WhatsApp or email, and how to use ARC (Today shows tasks and due follow-ups; Leads is the list with inbound and outbound; open a lead to call, log what happened, set a follow-up, research the business or draft an email; AI calls has the AI caller's recordings and transcripts).

Style: short, plain, practical. Use the same language they write in (English, Hinglish, Kannada and so on). No em dashes. When you draft something they will send, keep it ready to paste.

ABOUT THEM
${ctx}

PLAYBOOK
${playbook || "(The owner has not written the playbook yet. Say so if asked about PROXe specifics, and point them to Z.)"}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: HAIKU,
      max_tokens: 1200,
      system,
      messages: [...history, { role: "user", content: text }],
    });
    const answer = r.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n").trim()
      || "I couldn't answer that. Try asking another way.";
    recordUsage(HAIKU, r.usage.input_tokens, r.usage.output_tokens, "team_chat");
    if (memberId) {
      // Explicit times: one insert would stamp both rows alike and lose their order.
      const t = Date.now();
      await tdb.from("team_chat").insert([
        { member_id: memberId, role: "user", content: text, created_at: new Date(t).toISOString() },
        { member_id: memberId, role: "assistant", content: answer, created_at: new Date(t + 1).toISOString() },
      ]);
    }
    return Response.json({ answer });
  } catch (e) {
    return Response.json({ error: `The assistant had a problem: ${(e as Error).message}` }, { status: 502 });
  }
}
