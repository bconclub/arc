import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveViewer } from "@/lib/investor/viewer";
import { InvestorDashboard } from "@/components/investor/InvestorDashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "PROXe · Investor view" };

export default async function InvestorPage({ searchParams }: { searchParams: { as?: string } }) {
  const jar = cookies();
  const viewer = await resolveViewer(jar, searchParams.as);
  if (!viewer) redirect("/investor/login");
  // Signed in as an investor, or the owner looking through one investor's eyes.
  const viewingAs = viewer.role === "investor" && !jar.get("arc_investor") ? viewer.investor.id : null;
  return <InvestorDashboard role={viewingAs ? "owner" : viewer.role} viewAs={viewingAs} />;
}
