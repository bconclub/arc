import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, INVESTOR_COOKIE, verifyInvestorToken, verifySessionToken } from "@/lib/auth";
import type { Viewer } from "./data";

type CookieReader = { get(name: string): { value: string } | undefined };

async function loadInvestor(investorId: string, requireActive: boolean): Promise<Viewer | null> {
  const { data } = await supabaseAdmin
    .from("investors")
    .select("id,name,committed_amount,received_amount,equity_pct,round,currency,invested_on,active")
    .eq("id", investorId)
    .maybeSingle();
  if (!data || (requireActive && !data.active)) return null;
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

/**
 * Who is looking at the investor portal. SERVER ONLY.
 *
 * An investor token is checked against the database on every request, not
 * just its signature: switching an investor to inactive locks them out at
 * once instead of when their cookie expires.
 *
 * The owner's ARC session opens the portal as a preview, and with ?as=<id>
 * renders it exactly as that one investor sees it. Only the owner cookie
 * unlocks "view as"; an investor passing ?as= still sees only themselves.
 */
export async function resolveViewer(cookies: CookieReader, viewAs?: string | null): Promise<Viewer | null> {
  const investorId = await verifyInvestorToken(cookies.get(INVESTOR_COOKIE)?.value);
  if (investorId) {
    const self = await loadInvestor(investorId, true);
    if (self) return self;
    // A deactivated or deleted investor's cookie grants nothing, but it must
    // not shadow an owner session sitting in the same browser.
  }
  if (!(await verifySessionToken(cookies.get(COOKIE_NAME)?.value))) return null;
  if (viewAs && /^[0-9a-f-]{36}$/i.test(viewAs)) {
    const as = await loadInvestor(viewAs, false);
    if (as) return as;
  }
  return { role: "owner" };
}
