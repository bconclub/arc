"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarCheck, LogOut, MessageCircle, PhoneCall, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The whole chrome for a team login (sales): one bar with their five places,
 * no ARC sidebar. On a phone the places move to a bottom bar.
 */
const NAV = [
  { href: "/team", label: "Today", icon: CalendarCheck, exact: true },
  { href: "/team/leads", label: "Leads", icon: Users },
  { href: "/team/calls", label: "AI calls", icon: PhoneCall },
  { href: "/team/ask", label: "Ask", icon: MessageCircle },
  { href: "/team/playbook", label: "Playbook", icon: BookOpen },
];

export function TeamShell({ name, owner, children }: { name: string; owner: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const on = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path === n.href || path.startsWith(n.href + "/"));
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {owner && (
        <div className="bg-[var(--brand-soft)] px-4 py-1.5 text-center text-[12px] text-[var(--brand-text)]">
          You are seeing the sales view as the owner.{" "}
          <Link href="/dashboard/team" className="underline">Manage the team</Link>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4 lg:px-6">
          <Link href="/team" className="flex shrink-0 items-center gap-2 text-[15px] font-bold tracking-tight text-text">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" /> BCON Sales
          </Link>
          <nav aria-label="Sales sections" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={on(n) ? "page" : undefined}
                className={`flex h-9 items-center gap-1.5 rounded-soft px-3 text-[13px] ${on(n) ? "bg-[var(--surface-hover)] font-semibold text-text" : "text-text-muted hover:text-text"}`}>
                <n.icon size={14} /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[12.5px] text-text-muted sm:inline">{name}</span>
            <ThemeToggle />
            <button onClick={logout} className="flex h-9 items-center gap-1.5 rounded-soft px-3 text-[12.5px] text-text-muted hover:bg-[var(--surface-hover)] hover:text-text">
              <LogOut size={14} /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1200px] px-4 py-5 lg:px-6">{children}</main>
      <nav aria-label="Sales sections" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--bg)] md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={on(n) ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] ${on(n) ? "font-semibold text-text" : "text-text-muted"}`}>
            <n.icon size={18} /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
