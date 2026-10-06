import { cookies } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { OpsChat } from "@/components/ops/OpsChat";
import { StudioShell, RoleProvider } from "@/components/StudioShell";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/**
 * The shell is the sidebar and the page, nothing else.
 *
 * The old TopBar held a theme toggle, import/export buttons and a date, above
 * every page's own header. That was two stacked headers competing for the top of
 * the screen, so it is gone; the theme toggle moved into the sidebar footer,
 * which is the only thing in it that was load-bearing. Pages now own the full
 * viewport height, with no 3.5rem strip to subtract.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already let only the owner or a studio login through. Anyone who
  // is not the owner is a studio login: Studio chrome only, no sidebar, no ARC chat.
  const owner = await verifySessionToken(cookies().get(COOKIE_NAME)?.value);
  if (!owner) return <StudioShell>{children}</StudioShell>;

  return (
    <RoleProvider role="owner">
    <div className="min-h-screen">
      <Sidebar />
      <main className="flex min-h-screen min-w-0 flex-col pb-20 lg:ml-[200px] lg:pb-0">
        <div className="min-w-0 flex-1 animate-fade-in">{children}</div>
      </main>
      {/* Floating on every page: click the bubble, talk to ARC. Confirmed
          changes broadcast arc:data-changed for the page behind to reload. */}
      <OpsChat />
    </div>
    </RoleProvider>
  );
}
