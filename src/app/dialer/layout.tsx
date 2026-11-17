import { redirect } from "next/navigation";
import { getViewer } from "@/lib/team";
import { DialerProvider } from "@/components/team/Dialer";

export const dynamic = "force-dynamic";
export const metadata = { title: "PROXe Dialer" };

/** The dialer on its own: sign in, land here, start calling. Team logins and the owner. */
export default async function DialerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/dialer");
  return <DialerProvider>{children}</DialerProvider>;
}
