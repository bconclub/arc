// Shared matching for the outreach board. The dial ingest and the PROXe
// conversation ingest must agree on "this number is this target", or the same
// person splits into two rows the moment a reply lands.

import { supabaseAdmin } from "@/lib/supabase";

export const OUTREACH_CHANNELS = [
  "email",
  "linkedin",
  "whatsapp",
  "call",
  "instagram",
  "web",
] as const;

export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const OUTREACH_STATUSES = [
  "identified",
  "researched",
  "drafted",
  "sent",
  "replied",
  "meeting",
  "won",
  "lost",
  "no_reply",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export type OutreachTargetHit = {
  id: string;
  status: string;
  phone: string | null;
  name: string;
};

/** Last 10 digits. Indian mobiles and +91 forms collapse to the same key. */
export function last10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function coerceChannel(raw: unknown): OutreachChannel {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "voice") return "call";
  if ((OUTREACH_CHANNELS as readonly string[]).includes(s)) return s as OutreachChannel;
  return "whatsapp";
}

export function isOutreachStatus(raw: unknown): raw is OutreachStatus {
  return typeof raw === "string" && (OUTREACH_STATUSES as readonly string[]).includes(raw);
}

export async function findOutreachTarget(opts: {
  target_id?: string;
  phone?: string;
}): Promise<OutreachTargetHit | null> {
  if (opts.target_id) {
    const { data } = await supabaseAdmin
      .from("outreach_targets")
      .select("id, status, phone, name")
      .eq("id", String(opts.target_id))
      .maybeSingle();
    return (data as OutreachTargetHit | null) ?? null;
  }

  if (!opts.phone) return null;
  const key = last10(opts.phone);
  if (key.length < 10) return null;

  const { data } = await supabaseAdmin
    .from("outreach_targets")
    .select("id, status, phone, name")
    .not("phone", "is", null);

  const hit = (data ?? []).find((t) => last10(String(t.phone)) === key);
  return hit ? (hit as OutreachTargetHit) : null;
}
