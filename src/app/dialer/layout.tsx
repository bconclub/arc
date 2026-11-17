import { getViewer } from "@/lib/team";
import { DialerProvider } from "@/components/team/Dialer";
import { PinGate } from "./PinGate";

export const dynamic = "force-dynamic";
// Its own manifest, so the dialer installs on a phone as "PROXe Dialer" and opens here.
export const metadata = { title: "PROXe Dialer", manifest: "/dialer/manifest.webmanifest" };

/**
 * The dialer on its own. Not signed in: the passcode pad (each caller's own
 * 6-digit passcode signs them in as themselves). Signed in (a caller, or the
 * owner): the dialer.
 */
export default async function DialerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return <PinGate />;
  return <DialerProvider>{children}</DialerProvider>;
}
