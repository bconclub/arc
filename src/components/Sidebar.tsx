"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutGrid, PenLine, Calendar, BarChart3, Palette, Database, Bot, Settings,
  Sun, FolderKanban, Users, FileText, Wallet, BellRing, TrendingUp, CalendarDays, LogOut,
} from "lucide-react";
import { VERSION } from "@/lib/version";

type NavItem = { label: string; href: string; icon: typeof Sun; exact?: boolean };
type NavSection = { title: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    title: "Operations",
    items: [
      { label: "Today", href: "/dashboard/ops", icon: Sun, exact: true },
      { label: "Projects", href: "/dashboard/ops/projects", icon: FolderKanban },
      { label: "Money", href: "/dashboard/ops/money", icon: Wallet },
      { label: "Proposals", href: "/dashboard/ops/proposals", icon: FileText },
      { label: "People", href: "/dashboard/ops/people", icon: Users },
      { label: "Alerts", href: "/dashboard/ops/alerts", icon: BellRing },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Feed", href: "/dashboard/feed", icon: LayoutGrid },
      { label: "Write", href: "/dashboard/write", icon: PenLine },
      { label: "Schedule", href: "/dashboard/schedule", icon: Calendar },
      { label: "Results", href: "/dashboard/results", icon: BarChart3 },
      { label: "Style", href: "/dashboard/style", icon: Palette },
      { label: "Sources", href: "/dashboard/sources", icon: Database },
      { label: "ARC Agent", href: "/dashboard/arc", icon: Bot },
    ],
  },
  {
    title: "Brand",
    items: [
      { label: "Metrics", href: "/dashboard/brand/metrics", icon: TrendingUp },
      { label: "Calendar", href: "/dashboard/brand/calendar", icon: CalendarDays },
    ],
  },
];

const configItem: NavItem = { label: "Config", href: "/dashboard/config", icon: Settings };

// curated for the small screen
const mobileItems: NavItem[] = [
  { label: "Today", href: "/dashboard/ops", icon: Sun, exact: true },
  { label: "Feed", href: "/dashboard/feed", icon: LayoutGrid },
  { label: "Write", href: "/dashboard/write", icon: PenLine },
  { label: "Brand", href: "/dashboard/brand/metrics", icon: TrendingUp },
  { label: "Config", href: "/dashboard/config", icon: Settings },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200 ${
        active
          ? "bg-text text-bg font-medium shadow-sm"
          : "text-text-muted hover:text-text hover:bg-[var(--glow-white)]"
      }`}
    >
      <item.icon size={16} strokeWidth={active ? 2 : 1.6} className="shrink-0" />
      <span className="nav-label text-[13px]">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar fixed top-0 left-0 z-40 h-screen bg-surface/80 backdrop-blur-xl border-r border-[var(--border)] flex-col hidden lg:flex overflow-hidden">
        {/* Logo (text only) */}
        <div className="w-full flex items-center px-4 py-4 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold tracking-tight text-text shrink-0">ARC</span>
            <span className="logo-full text-[10px] font-medium px-1.5 py-0.5 rounded border border-[var(--border-strong)] text-text-muted">
              v{VERSION}
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="nav-label px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-[var(--border)] pt-3 space-y-0.5">
            <NavLink item={configItem} pathname={pathname} />
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 px-3 py-2 rounded-full text-sm text-text-muted transition-all duration-200 hover:text-text hover:bg-[var(--glow-white)]"
            >
              <LogOut size={16} strokeWidth={1.6} className="shrink-0" />
              <span className="nav-label text-[13px]">Log out</span>
            </button>
          </div>
        </nav>

        {/* Brand */}
        <div className="px-3 py-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[var(--glow-white)] transition-colors cursor-pointer overflow-hidden">
            <Image
              src="/bcon-icon.png"
              alt="BCON Club"
              width={32}
              height={32}
              className="w-7 h-7 rounded-full object-cover border border-[var(--border)] shrink-0"
            />
            <p className="user-text text-sm font-medium text-text truncate min-w-0">BCON Club</p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-50 lg:hidden flex items-center justify-around px-1 py-2 safe-area-pb">
        {mobileItems.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 ${
                active ? "text-text" : "text-text-muted"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? "bg-[var(--glow-white)]" : ""}`}>
                <item.icon size={16} strokeWidth={active ? 2 : 1.5} />
              </div>
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
