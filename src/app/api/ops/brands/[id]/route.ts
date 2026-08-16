import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPatch, patchError } from "@/lib/ops-fields";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json();
  const res = buildPatch("brands", body);
  if (!res.ok) return NextResponse.json(patchError(res), { status: 400 });
  const patch = { ...res.patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin.from("brands").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * Counts what is attached to a brand before anything is removed.
 *
 * Invoices, projects and proposals hold the client as free text, so deleting a
 * brand does not delete them. It orphans them: the money stays in the database
 * with nothing to roll it up to, and quietly disappears from every screen. So
 * the count is reported and a brand holding real records is refused unless the
 * caller says explicitly to go ahead.
 */
async function attachments(id: string, name: string) {
  const like = `%${name}%`;
  const [people, docs, payments, projects, proposals] = await Promise.all([
    supabaseAdmin.from("people").select("id", { count: "exact", head: true }).eq("brand_id", id),
    supabaseAdmin.from("billing_documents").select("id", { count: "exact", head: true }).eq("brand_id", id),
    supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).ilike("client", like),
    supabaseAdmin.from("projects").select("id", { count: "exact", head: true }).ilike("client", like),
    supabaseAdmin.from("proposals").select("id", { count: "exact", head: true }).ilike("client", like),
  ]);
  return {
    people: people.count ?? 0,
    documents: docs.count ?? 0,
    payments: payments.count ?? 0,
    projects: projects.count ?? 0,
    proposals: proposals.count ?? 0,
  };
}

/** GET returns what would be affected, so the UI can say so before asking. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { data: brand } = await supabaseAdmin.from("brands").select("id,name").eq("id", ctx.params.id).single();
  if (!brand) return NextResponse.json({ error: "No such brand." }, { status: 404 });
  const counts = await attachments(brand.id, brand.name);
  return NextResponse.json({ brand, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const force = req.nextUrl.searchParams.get("force") === "1";

  const { data: brand } = await supabaseAdmin.from("brands").select("id,name").eq("id", id).single();
  if (!brand) return NextResponse.json({ error: "No such brand." }, { status: 404 });

  const counts = await attachments(brand.id, brand.name);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > 0 && !force) {
    return NextResponse.json({
      error: `${brand.name} still has records attached. Deleting it would leave them with nothing to roll up to.`,
      counts, total,
    }, { status: 409 });
  }

  // People point at the brand by id, so they would be left pointing at nothing.
  // Clearing the link keeps the contact and drops only the association.
  if (counts.people > 0) await supabaseAdmin.from("people").update({ brand_id: null }).eq("brand_id", id);

  const { error } = await supabaseAdmin.from("brands").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: brand.name, counts });
}
