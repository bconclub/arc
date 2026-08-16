import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPatch, WRITABLE } from "@/lib/ops-fields";
import type { Mutation, Candidate } from "@/lib/chat/resolve";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

/**
 * POST /api/ops/chat/intents/{id} { action: "confirm" | "reject", candidateId? }
 *
 * The only place chat mutations touch the database. Every mutation is
 * revalidated against the shared writable-field map at apply time — the
 * intent was stored earlier and the rules may have changed since — and each
 * one records its own result, because supabase-js has no transactions and a
 * half-applied intent must say exactly which half.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  const { data: intent, error: readErr } = await supabaseAdmin
    .from("update_intents").select("*").eq("id", id).single();
  if (readErr || !intent) {
    return NextResponse.json({ error: readErr?.message ?? "No such intent." }, { status: 404 });
  }
  if (intent.status !== "pending") {
    return NextResponse.json({ error: `That intent is already ${intent.status}.` }, { status: 409 });
  }

  const say = async (content: string) => {
    if (!intent.session_id) return null;
    const { data } = await supabaseAdmin.from("chat_messages")
      .insert({ session_id: intent.session_id, role: "assistant", content })
      .select("*").single();
    return data;
  };

  if (action === "reject") {
    await supabaseAdmin.from("update_intents").update({ status: "rejected" }).eq("id", id);
    const msg = await say("Left everything as it was.");
    return NextResponse.json({ ok: true, status: "rejected", message: msg });
  }
  if (action !== "confirm") {
    return NextResponse.json({ error: 'action must be "confirm" or "reject"' }, { status: 400 });
  }

  // A candidate pick narrows the intent to that candidate's mutations.
  let mutations = (intent.mutations ?? []) as Mutation[];
  if (body.candidateId) {
    const candidates = (intent.candidates ?? []) as Candidate[];
    const chosen = candidates.find((c) => c.id === body.candidateId);
    if (!chosen) return NextResponse.json({ error: "That candidate is not on this intent." }, { status: 400 });
    mutations = chosen.mutations;
  }
  if (!mutations.length) {
    return NextResponse.json({ error: "This intent has no changes to apply — pick a candidate." }, { status: 400 });
  }

  const results: { label: string; ok: boolean; error?: string; id?: string }[] = [];
  for (const m of mutations) {
    if (!(m.table in WRITABLE)) {
      results.push({ label: m.label, ok: false, error: `table ${m.table} is not writable` });
      continue;
    }
    const built = buildPatch(m.table, m.set as Record<string, unknown>);
    if (!built.ok) {
      results.push({ label: m.label, ok: false, error: "fields no longer writable" });
      continue;
    }
    if (m.op === "update") {
      const { data, error } = await supabaseAdmin
        .from(m.table).update(built.patch).eq("id", m.id!).select("id").single();
      results.push({ label: m.label, ok: !error, error: error?.message, id: data?.id });
    } else {
      const { data, error } = await supabaseAdmin
        .from(m.table).insert(built.patch).select("id").single();
      results.push({ label: m.label, ok: !error, error: error?.message, id: data?.id });
    }
  }

  const allOk = results.every((r) => r.ok);
  const applied = results.filter((r) => r.ok);

  await supabaseAdmin.from("update_intents").update({
    status: allOk ? "applied" : "failed",
    result: results,
    applied_at: new Date().toISOString(),
    ...(body.candidateId ? { mutations } : {}),
  }).eq("id", id);

  // History — one row per applied change, so the timeline reads as it happened.
  for (let i = 0; i < mutations.length; i++) {
    if (!results[i]?.ok) continue;
    await supabaseAdmin.from("ops_events").insert({
      kind: "chat_update",
      summary: mutations[i].label,
      brand_id: intent.brand_id,
      refs: [{ table: mutations[i].table, id: results[i].id ?? mutations[i].id }],
      payload: { set: mutations[i].set },
      source: "chat",
    });
  }

  const msg = await say(
    allOk
      ? `Done: ${applied.map((r) => r.label).join("; ")}.`
      : `Partly done. ${applied.length ? `Applied: ${applied.map((r) => r.label).join("; ")}. ` : ""}Failed: ${results.filter((r) => !r.ok).map((r) => `${r.label} (${r.error})`).join("; ")}.`,
  );

  return NextResponse.json({ ok: allOk, status: allOk ? "applied" : "failed", results, message: msg });
}
