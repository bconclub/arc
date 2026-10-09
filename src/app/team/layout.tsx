import { redirect } from "next/navigation";
import { TeamShell } from "@/components/team/TeamShell";
import { getViewer } from "@/lib/team";

export const dynamic = "force-dynamic";
export const metadata = { title: "BCON Sales" };

/** The sales team's view. Middleware lets in a team login or the owner (as a preview). */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/team");
  return (
    <TeamShell name={viewer.kind === "team" ? viewer.member.name : "Owner"} owner={viewer.kind === "owner"}>
      {children}
    </TeamShell>
  );
}
