import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveViewer } from "@/lib/investor/viewer";
import { InvestorDashboard } from "@/components/investor/InvestorDashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "PROXe · Investor view" };

export default async function InvestorPage() {
  const viewer = await resolveViewer(cookies());
  if (!viewer) redirect("/investor/login");
  return <InvestorDashboard role={viewer.role} />;
}
