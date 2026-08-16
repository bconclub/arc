import { supabaseAdmin } from "@/lib/supabase";
import { brandForText } from "@/lib/brand-match";
import type { Brand, Payment, Project } from "@/types/ops";
import type { Intent } from "./rules";

/**
 * Turns a parsed intent into concrete row mutations against live data.
 *
 * The rule of the whole feature: resolution proposes, it never applies.
 * Exactly one plausible row → a ready-to-confirm mutation. Several → they are
 * offered as candidates rather than guessed between. None → an insert is
 * proposed where that makes sense, or the honest "couldn't find it".
 */

export type Mutation = {
  table: "projects" | "payments" | "proposals";
  op: "update" | "insert";
  id?: string;
  set: Record<string, unknown>;
  /** one line the confirm card shows for this change */
  label: string;
};

export type Candidate = {
  id: string;
  label: string;
  mutations: Mutation[];
};

export type Resolution = {
  brand: Brand | null;
  mutations: Mutation[];
  candidates: Candidate[];
  /** what the assistant says above the card */
  say: string;
  confidence: "high" | "medium" | "low";
};

const today = () => new Date().toISOString().slice(0, 10);

function scoreByText(name: string | null, subject: string): number {
  if (!name) return 0;
  const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const hay = subject.toLowerCase();
  return words.filter((w) => hay.includes(w)).length;
}

export async function resolveIntent(intent: Intent): Promise<Resolution> {
  const { data: brandRows } = await supabaseAdmin.from("brands").select("*");
  const brands = (brandRows ?? []) as Brand[];
  const brand = brandForText(intent.subject, brands);

  const none = (say: string): Resolution =>
    ({ brand, mutations: [], candidates: [], say, confidence: "low" });

  if (intent.action === "mark_done" || intent.action === "set_status") {
    const status = intent.action === "mark_done" ? "done" : (intent.status ?? "active");
    const { data } = await supabaseAdmin
      .from("projects").select("*").neq("status", "done");
    let projects = (data ?? []) as Project[];
    if (brand) {
      const scoped = projects.filter(
        (p) => p.brand_id === brand.id || (p.client ?? "").toLowerCase().includes(brand.name.toLowerCase()),
      );
      if (scoped.length) projects = scoped;
    }
    // The words may name the project directly ("the exam platform is done").
    const scored = projects
      .map((p) => ({ p, score: scoreByText(p.name, intent.subject) }))
      .sort((a, b) => b.score - a.score);
    const top = scored.filter((s) => s.score > 0 && s.score === scored[0].score).map((s) => s.p);
    const pool = top.length ? top : projects;

    if (!pool.length) return none(brand
      ? `I can't find an open project for ${brand.name}.`
      : "I can't tell which project that is — name the brand or the project.");

    const mutationFor = (p: Project): Mutation => ({
      table: "projects",
      op: "update",
      id: p.id,
      set: status === "done" ? { status: "done", progress: 100 } : { status },
      label: `${p.name} (${p.client ?? "no client"}) → ${status}`,
    });

    if (pool.length === 1) {
      const p = pool[0];
      return {
        brand, candidates: [], mutations: [mutationFor(p)],
        say: status === "done"
          ? `Okay — marking ${p.name} as done.`
          : `Okay — setting ${p.name} to ${status}.`,
        confidence: "high",
      };
    }
    return {
      brand, mutations: [],
      candidates: pool.slice(0, 6).map((p) => ({
        id: p.id,
        label: `${p.name} — ${p.client ?? "no client"} (${p.status})`,
        mutations: [mutationFor(p)],
      })),
      say: `Which project? ${brand ? `${brand.name} has` : "I see"} ${pool.length} open.`,
      confidence: "medium",
    };
  }

  if (intent.action === "mark_paid") {
    const { data } = await supabaseAdmin
      .from("payments").select("*").neq("status", "paid");
    let payments = (data ?? []) as Payment[];
    if (brand) {
      const scoped = payments.filter(
        (p) => p.brand_id === brand.id || (p.client ?? "").toLowerCase().includes(brand.name.toLowerCase()),
      );
      if (scoped.length) payments = scoped;
    }
    if (intent.amount != null) {
      const exact = payments.filter((p) => p.amount != null && Math.abs(p.amount - intent.amount!) < 1);
      if (exact.length) payments = exact;
    }

    const mutationFor = (p: Payment): Mutation => ({
      table: "payments",
      op: "update",
      id: p.id,
      set: { status: "paid", paid_at: new Date().toISOString() },
      label: `${p.client ?? "?"} — ${p.item ?? "payment"}${p.amount != null ? ` (₹${p.amount.toLocaleString("en-IN")})` : ""} → paid`,
    });

    if (payments.length === 1) {
      const p = payments[0];
      return {
        brand, candidates: [], mutations: [mutationFor(p)],
        say: `Okay — recording ${p.client ?? "that"} payment${p.amount != null ? ` of ₹${p.amount.toLocaleString("en-IN")}` : ""} as received today.`,
        confidence: "high",
      };
    }
    if (payments.length > 1) {
      return {
        brand, mutations: [],
        candidates: payments.slice(0, 6).map((p) => ({ id: p.id, label: mutationFor(p).label, mutations: [mutationFor(p)] })),
        say: `Which one landed? ${brand ? brand.name : "There"} ${payments.length > 1 ? `has ${payments.length} open` : ""}.`,
        confidence: "medium",
      };
    }
    // Nothing open — record the money anyway rather than losing the fact.
    if (brand || intent.amount != null) {
      // "50% advance came in": with no rupee figure, the share is computed
      // from the one deal it can only mean — a single open project with a
      // budget, or failing that a single won/sent proposal with an amount.
      let amount = intent.amount;
      let basis = "";
      if (amount == null && intent.pct != null && brand) {
        const { data: projRows } = await supabaseAdmin
          .from("projects").select("*").neq("status", "done");
        const scoped = ((projRows ?? []) as Project[]).filter(
          (p) => (p.brand_id === brand.id || (p.client ?? "").toLowerCase().includes(brand.name.toLowerCase())) && p.budget != null,
        );
        if (scoped.length === 1) {
          amount = Math.round((scoped[0].budget ?? 0) * intent.pct / 100);
          basis = ` (${intent.pct}% of ${scoped[0].name}'s ₹${(scoped[0].budget ?? 0).toLocaleString("en-IN")})`;
        }
      }
      return {
        brand, candidates: [],
        mutations: [{
          table: "payments", op: "insert",
          set: {
            client: brand?.name ?? null,
            brand_id: brand?.id ?? null,
            amount,
            status: "paid",
            paid_at: new Date().toISOString(),
            item: intent.subject.slice(0, 120),
            source: "chat",
          },
          label: `New payment: ${brand?.name ?? "unknown"}${amount != null ? ` ₹${amount.toLocaleString("en-IN")}` : ""}${basis} — paid today`,
        }],
        say: `No open invoice matches, so I'll record it as a new received payment${brand ? ` for ${brand.name}` : ""}${basis}. Confirm?`,
        confidence: "medium",
      };
    }
    return none("I can't tell whose payment that is — name the brand or the amount.");
  }

  if (intent.action === "create_proposal") {
    return {
      brand, candidates: [],
      mutations: [{
        table: "proposals", op: "insert",
        set: {
          name: intent.subject.slice(0, 120),
          client: brand?.name ?? null,
          brand_id: brand?.id ?? null,
          amount: intent.amount,
          status: "sent",
          sent: today(),
        },
        label: `New proposal: ${brand?.name ?? "unknown client"}${intent.amount != null ? ` — ₹${intent.amount.toLocaleString("en-IN")}` : ""}`,
      }],
      say: `Okay — logging a sent proposal${brand ? ` for ${brand.name}` : ""}${intent.amount != null ? ` at ₹${intent.amount.toLocaleString("en-IN")}` : ""}.`,
      confidence: brand ? "high" : "medium",
    };
  }

  if (intent.action === "create_payment") {
    return {
      brand, candidates: [],
      mutations: [{
        table: "payments", op: "insert",
        set: {
          client: brand?.name ?? null,
          brand_id: brand?.id ?? null,
          amount: intent.amount,
          status: "invoiced",
          item: intent.subject.slice(0, 120),
          source: "chat",
        },
        label: `New invoice: ${brand?.name ?? "unknown"}${intent.amount != null ? ` — ₹${intent.amount.toLocaleString("en-IN")}` : ""}`,
      }],
      say: `Okay — recording an invoice${brand ? ` to ${brand.name}` : ""}${intent.amount != null ? ` for ₹${intent.amount.toLocaleString("en-IN")}` : ""}.`,
      confidence: brand ? "high" : "medium",
    };
  }

  return none("I couldn't work out what to change from that. Tell me the brand and what happened.");
}
