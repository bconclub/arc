"use client";

import { createContext, useContext } from "react";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Which login is looking at the dashboard. "studio" is the social media team's
 * login: Studio only. Pages read it to hide links into the rest of ARC.
 */
export type Role = "owner" | "studio";
const RoleContext = createContext<Role>("owner");
export const useRole = () => useContext(RoleContext);

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** The whole chrome for a studio login: one slim bar, no sidebar, no ARC chat. */
export function StudioShell({ children }: { children: React.ReactNode }) {
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <RoleProvider role="studio">
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-6">
            <a href="/dashboard/studio" className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-text">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" /> BCON Studio
            </a>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={logout} className="flex h-9 items-center gap-1.5 rounded-soft px-3 text-[12.5px] text-text-muted hover:bg-[var(--surface-hover)] hover:text-text">
                <LogOut size={14} /> Log out
              </button>
            </div>
          </div>
        </header>
        <main className="min-w-0">{children}</main>
      </div>
    </RoleProvider>
  );
}
