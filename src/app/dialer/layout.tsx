import { getViewer } from "@/lib/team";
import { DialerProvider } from "@/components/team/Dialer";
import { PinGate } from "./PinGate";
import { UseDialerManifest } from "./UseDialerManifest";

export const dynamic = "force-dynamic";
export const metadata = { title: "PROXe Dialer" };

/**
 * The dialer on its own. Not signed in: the passcode pad (each caller's own
 * 6-digit passcode signs them in as themselves). Signed in (a caller, or the
 * owner): the dialer. Installs on a phone as its own app (UseDialerManifest).
 */
export default async function DialerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  return (
    <>
      <UseDialerManifest />
      {viewer ? <DialerProvider>{children}</DialerProvider> : <PinGate />}
    </>
  );
}
