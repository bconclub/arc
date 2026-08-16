import { supabaseAdmin } from "@/lib/supabase";
import { brandForText } from "@/lib/brand-match";
import { rollupBrand } from "@/lib/rollup";
import type { Brand, OpsSignal, Payment, Project, Proposal } from "@/types/ops";

/**
 * Read-only answers for the chat: "what's going on with WindChasers?".
 * Numbers come from rollupBrand — the same function every dashboard panel
 * uses, so the chat can never disagree with the screen it sits on.
 */

export type RecordCard = {
  type: "record";
  brand: { id: string; name: string } | null;
  stats: { label: string; value: string }[];
  timeline: { when: string; what: string }[];
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export async function answerQuestion(text: string): Promise<{ say: string; card: RecordCard | null }> {
  const [{ data: brandRows }, { data: projectRows }, { data: paymentRows }, { data: proposalRows }] =
    await Promise.all([
      supabaseAdmin.from("brands").select("*"),
      supabaseAdmin.from("projects").select("*"),
      supabaseAdmin.from("payments").select("*"),
      supabaseAdmin.from("proposals").select("*"),
    ]);
  const brands = (brandRows ?? []) as Brand[];
  const projects = (projectRows ?? []) as Project[];
  const payments = (paymentRows ?? []) as Payment[];
  const proposals = (proposalRows ?? []) as Proposal[];

  const brand = brandForText(text, brands);

  if (!brand) {
    // A portfolio-level question: answer with the headline numbers.
    const open = projects.filter((p) => p.status === "active" || p.status === "waiting");
    const owed = payments.filter((p) => p.status !== "paid" && p.amount != null)
      .reduce((a, p) => a + (p.amount ?? 0), 0);
    return {
      say: `${open.length} projects in flight, ${inr(owed)} outstanding across ${payments.filter((p) => p.status !== "paid").length} open invoices. Name a brand for its full picture.`,
      card: null,
    };
  }

  const r = rollupBrand(brand, projects, payments, proposals, [] as OpsSignal[]);

  // A dated thread of the recent record, newest first.
  const events: { when: string; what: string }[] = [];
  const mine = (client: string | null) =>
    client != null && (brand.aliases ?? []).concat(brand.name).some((k) => client.toLowerCase().includes(String(k).toLowerCase()));
  for (const p of projects.filter((p) => p.brand_id === brand.id || mine(p.client))) {
    events.push({ when: p.created_at, what: `Project: ${p.name} (${p.status}, ${p.progress}%)` });
  }
  for (const p of payments.filter((p) => p.brand_id === brand.id || mine(p.client))) {
    events.push({
      when: p.paid_at ?? p.created_at,
      what: `${p.status === "paid" ? "Received" : "Invoice"}: ${p.item ?? ""}${p.amount != null ? ` ${inr(p.amount)}` : ""} (${p.status})`,
    });
  }
  for (const p of proposals.filter((p) => p.brand_id === brand.id || mine(p.client))) {
    events.push({ when: p.sent ?? p.created_at, what: `Proposal: ${p.name}${p.amount != null ? ` ${inr(p.amount)}` : ""} (${p.status})` });
  }
  const { data: opsEvents } = await supabaseAdmin
    .from("ops_events").select("created_at,summary").eq("brand_id", brand.id)
    .order("created_at", { ascending: false }).limit(10);
  for (const e of opsEvents ?? []) events.push({ when: e.created_at, what: e.summary });

  events.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));

  const bits: string[] = [];
  if (r.runningProjects) bits.push(`${r.runningProjects} project${r.runningProjects > 1 ? "s" : ""} running`);
  if (r.parkedProjects) bits.push(`${r.parkedProjects} parked`);
  if (r.owed) bits.push(`${inr(r.owed)} outstanding`);
  if (r.overdue) bits.push(`${inr(r.overdue)} of it overdue`);
  if (r.pipeline) bits.push(`${inr(r.pipeline)} in proposals`);
  const say = `${brand.name}: ${bits.length ? bits.join(", ") : "nothing currently in flight"}.`;

  return {
    say,
    card: {
      type: "record",
      brand: { id: brand.id, name: brand.name },
      stats: [
        { label: "Outstanding", value: inr(r.owed) },
        { label: "Collected", value: inr(r.collected) },
        { label: "Overdue", value: inr(r.overdue) },
        { label: "Pipeline", value: inr(r.pipeline) },
        { label: "Open projects", value: String(r.openProjects) },
        { label: "Health", value: `${r.health}/100` },
      ],
      timeline: events.slice(0, 12),
    },
  };
}
