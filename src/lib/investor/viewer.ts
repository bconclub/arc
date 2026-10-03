import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, INVESTOR_COOKIE, verifyInvestorToken, verifySessionToken } from "@/lib/auth";
import type { Viewer } from "./data";

type CookieReader = { get(name: string): { value: string } | undefined };

/**
 * Who is looking at the investor portal. SERVER ONLY.
 *
 * An investor token is checked against the database on every request, not
 * just its signature: switching an investor to inactive locks them out at
 * once instead of when their cookie expires. The owner's ARC session also
 * opens the portal, as a preview of exactly what investors see.
 */
export async function resolveViewer(cookies: CookieReader): Promise<Viewer | null> {
  const investorId = await verifyInvestorToken(cookies.get(INVESTOR_COOKIE)?.value);
  if (investorId) {
    const { data } = await supabaseAdmin
      .from("investors")
      .select("id,name,committed_amount,received_amount,equity_pct,round,currency,invested_on,active")
      .eq("id", investorId)
      .maybeSingle();
    if (data?.active) {
      return {
        role: "investor",
        investor: {
          id: data.id,
          name: data.name,
          committed_amount: data.committed_amount == null ? null : Number(data.committed_amount),
          received_amount: data.received_amount == null ? null : Number(data.received_amount),
          equity_pct: data.equity_pct == null ? null : Number(data.equity_pct),
          round: data.round ?? null,
          currency: data.currency ?? "INR",
          invested_on: data.invested_on,
        },
      };
    }
  }
  if (await verifySessionToken(cookies.get(COOKIE_NAME)?.value)) return { role: "owner" };
  return null;
}
