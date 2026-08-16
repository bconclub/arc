import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { parseWithRules } from "@/lib/chat/rules";
import { parseWithModel, llmConfigured } from "@/lib/chat/llm";
import { resolveIntent } from "@/lib/chat/resolve";
import { answerQuestion } from "@/lib/chat/answers";
import type { Brand } from "@/types/ops";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const MIGRATION_NOTE = "Run the 20260816000000 migration to enable Ops Chat.";

function missingTables(message: string): boolean {
  return /chat_sessions|chat_messages|update_intents/.test(message);
}

/** GET /api/ops/chat[?sessionId=…] — latest session with messages and pending intent. */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  let session: { id: string } | null = null;
  if (sessionId) {
    const { data } = await supabaseAdmin.from("chat_sessions").select("id").eq("id", sessionId).maybeSingle();
    session = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("chat_sessions").select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error && missingTables(error.message)) {
      return NextResponse.json({ session: null, messages: [], detail: MIGRATION_NOTE });
    }
    session = data;
  }
  if (!session) return NextResponse.json({ session: null, messages: [] });

  const { data: messages } = await supabaseAdmin
    .from("chat_messages").select("*").eq("session_id", session.id)
    .order("created_at", { ascending: true }).limit(80);
  const { data: pending } = await supabaseAdmin
    .from("update_intents").select("*").eq("session_id", session.id).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  return NextResponse.json({ session, messages: messages ?? [], pending: pending ?? null });
}

/**
 * POST /api/ops/chat { sessionId?, text }
 *
 * One turn of the conversation. A statement becomes a pending intent with a
 * confirm card; a question is answered from the same rollups the dashboard
 * uses; a follow-up while an intent is pending refines that intent — the old
 * one is marked superseded, never silently replaced.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Say something first." }, { status: 400 });

  // ── session ──
  let sessionId: string | null = body.sessionId ?? null;
  if (!sessionId) {
    const { data, error } = await supabaseAdmin
      .from("chat_sessions").insert({ title: text.slice(0, 60) }).select("id").single();
    if (error) {
      return NextResponse.json(
        { error: missingTables(error.message) ? MIGRATION_NOTE : error.message },
        { status: 500 },
      );
    }
    sessionId = data.id;
  }

  await supabaseAdmin.from("chat_messages").insert({ session_id: sessionId, role: "user", content: text });

  // ── context: recent turns + any pending intent this may refine ──
  const { data: recent } = await supabaseAdmin
    .from("chat_messages").select("role,content").eq("session_id", sessionId)
    .order("created_at", { ascending: false }).limit(10);
  const { data: pending } = await supabaseAdmin
    .from("update_intents").select("*").eq("session_id", sessionId).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  // ── parse: rules always; the model refines when the rules are unsure ──
  let intent = parseWithRules(text);
  let parser: "rules" | "haiku" | "sonnet" = "rules";
  const needModel = intent.action === "unknown" || Boolean(pending);
  if (needModel && llmConfigured()) {
    const { data: brandRows } = await supabaseAdmin.from("brands").select("name,aliases");
    const modelRead = await parseWithModel(text, {
      brandNames: ((brandRows ?? []) as Pick<Brand, "name" | "aliases">[]).map((b) => b.name),
      recentMessages: (recent ?? []).reverse(),
      pendingIntent: pending ? { raw: pending.raw_text, mutations: pending.mutations } : null,
    });
    if (modelRead && modelRead.action !== "unknown") {
      intent = {
        action: modelRead.action,
        target: modelRead.target,
        status: modelRead.status,
        amount: modelRead.amount ?? intent.amount,
        subject: [modelRead.brand, modelRead.subject].filter(Boolean).join(" ") || text,
        raw: text,
      };
      parser = "haiku";
    }
  }

  // A refinement retires the pending intent whatever happens next.
  if (pending && intent.action !== "question") {
    await supabaseAdmin.from("update_intents")
      .update({ status: "superseded" }).eq("id", pending.id);
  }

  // ── questions: answered, no intent ──
  if (intent.action === "question") {
    const { say, card } = await answerQuestion(text);
    const { data: msg } = await supabaseAdmin.from("chat_messages")
      .insert({ session_id: sessionId, role: "assistant", content: say, card })
      .select("*").single();
    return NextResponse.json({ sessionId, message: msg, intent: null });
  }

  // ── notes: recorded straight to history — nothing to confirm ──
  if (intent.action === "add_note") {
    const { data: brandRows } = await supabaseAdmin.from("brands").select("*");
    const { brandForText } = await import("@/lib/brand-match");
    const brand = brandForText(intent.subject, (brandRows ?? []) as Brand[]);
    await supabaseAdmin.from("ops_events").insert({
      kind: "note", summary: intent.subject, brand_id: brand?.id ?? null, source: "chat",
    });
    const say = brand ? `Noted, under ${brand.name}.` : "Noted.";
    const { data: msg } = await supabaseAdmin.from("chat_messages")
      .insert({ session_id: sessionId, role: "assistant", content: say })
      .select("*").single();
    return NextResponse.json({ sessionId, message: msg, intent: null });
  }

  // ── statements: resolve to concrete changes and propose them ──
  const resolution = await resolveIntent(intent);

  if (!resolution.mutations.length && !resolution.candidates.length) {
    const { data: msg } = await supabaseAdmin.from("chat_messages")
      .insert({ session_id: sessionId, role: "assistant", content: resolution.say })
      .select("*").single();
    return NextResponse.json({ sessionId, message: msg, intent: null });
  }

  const { data: intentRow, error: intentErr } = await supabaseAdmin
    .from("update_intents")
    .insert({
      session_id: sessionId,
      raw_text: pending ? `${pending.raw_text} | ${text}` : text,
      brand_id: resolution.brand?.id ?? null,
      mutations: resolution.mutations,
      candidates: resolution.candidates.length ? resolution.candidates : null,
      parser,
      confidence: resolution.confidence,
      status: "pending",
    })
    .select("*").single();
  if (intentErr) return NextResponse.json({ error: intentErr.message }, { status: 500 });

  const card = {
    type: "intent",
    intentId: intentRow.id,
    mutations: resolution.mutations.map((m) => m.label),
    candidates: resolution.candidates.map((c) => ({ id: c.id, label: c.label })),
  };
  const { data: msg } = await supabaseAdmin.from("chat_messages")
    .insert({ session_id: sessionId, role: "assistant", content: resolution.say, intent_id: intentRow.id, card })
    .select("*").single();

  return NextResponse.json({ sessionId, message: msg, intent: intentRow });
}
