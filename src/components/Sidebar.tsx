"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Settings2, FileText, Boxes, FolderKanban, Wallet, Radio,
  Megaphone, BarChart3, Users, Radar, LayoutGrid, Rss, CalendarDays, PenLine,
  Palette, Bot, TrendingUp, Plug, Settings, LogOut, Menu, X,
} from "lucide-react";
import { VERSION } from "@/lib/version";
import { ArcLogo } from "@/components/ArcLogo";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Radar;
  exact?: boolean;
  /** Revealed when this item's subtree is the current page. */
  children?: NavItem[];
};

// Top level follows the agreed order. Anything that would otherwise be a
// 17-item flat list is nested under the section it belongs to, so nothing in
// the app is unreachable but the rail stays short.
const nav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/ops", icon: LayoutDashboard, exact: true },
  {
    label: "Operations", href: "/dashboard/operations", icon: Settings2,
    children: [
      { label: "People", href: "/dashboard/ops/people", icon: Users },
      { label: "Radar", href: "/dashboard/ops/alerts", icon: Radar },
    ],
  },
  { label: "Proposals", href: "/dashboard/ops/proposals", icon: FileText },
  { label: "Brands", href: "/dashboard/brands", icon: Boxes },
  { label: "Projects", href: "/dashboard/ops/projects", icon: FolderKanban },
  { label: "Money", href: "/dashboard/ops/money", icon: Wallet },
  {
    label: "Signals", href: "/dashboard/feed", icon: Radio,
    children: [
      { label: "Feed", href: "/dashboard/feed", icon: LayoutGrid },
      { label: "Sources", href: "/dashboard/sources", icon: Rss },
    ],
  },
  {
    label: "Content", href: "/dashboard/schedule", icon: Megaphone,
    children: [
      { label: "Content running", href: "/dashboard/schedule", icon: CalendarDays },
      { label: "Our content", href: "/dashboard/write", icon: PenLine },
      { label: "Style", href: "/dashboard/style", icon: Palette },
      { label: "ARC Agent", href: "/dashboard/arc", icon: Bot },
    ],
  },
  {
    label: "Analytics", href: "/dashboard/results", icon: BarChart3,
    children: [
      { label: "Results", href: "/dashboard/results", icon: BarChart3 },
      { label: "Brand metrics", href: "/dashboard/brand/metrics", icon: TrendingUp },
      { label: "Calendar", href: "/dashboard/brand/calendar", icon: CalendarDays },
    ],
  },
];

const footerNav: NavItem[] = [
  { label: "Admin", href: "/dashboard/admin", icon: Plug },
  { label: "Settings", href: "/dashboard/config", icon: Settings },
];

// Thumb-reachable shortcuts; "Menu" opens the full drawer so nothing is stranded.
const mobileQuick: NavItem[] = [
  { label: "Home", href: "/dashboard/ops", icon: LayoutDashboard, exact: true },
  { label: "Signals", href: "/dashboard/feed", icon: Radio },
  { label: "Brands", href: "/dashboard/brands", icon: Boxes },
  { label: "Money", href: "/dashboard/ops/money", icon: Wallet },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** A parent counts as active if it or any of its children matches. */
function inSubtree(pathname: string, item: NavItem) {
  return isActive(pathname, item) || (item.children ?? []).some((c) => isActive(pathname, c));
}

function rowCls(active: boolean, depth = 0) {
  return [
    "flex items-center gap-3 rounded-xl py-2 text-[13px] transition-colors duration-150",
    depth > 0 ? "pl-9 pr-3" : "px-3",
    active
      ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
      : "text-text-muted hover:bg-[var(--glow-white)] hover:text-text",
  ].join(" ");
}

function NavRows({ items, pathname, onNavigate }: {
  items: NavItem[]; pathname: string; onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const open = inSubtree(pathname, item);
        const selfActive = isActive(pathname, item) && !(item.children ?? []).some((c) => isActive(pathname, c));
        return (
          <div key={item.href + item.label}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={selfActive ? "page" : undefined}
              className={rowCls(open)}
            >
              <item.icon size={17} strokeWidth={open ? 2.2 : 1.7} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
            {open && item.children && (
              <div className="mt-0.5 space-y-0.5">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    aria-current={isActive(pathname, child) ? "page" : undefined}
                    className={rowCls(isActive(pathname, child), 1) + " text-[12.5px]"}
                  >
                    <child.icon size={14} strokeWidth={1.7} className="shrink-0" />
                    <span className="truncate">{child.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever the route changes, so tapping a link dismisses it.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Don't let the page scroll behind an open drawer.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const brandBlock = (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-2.5 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[12px] font-bold text-text">
        Z
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-text">Z</span>
        <span className="block truncate text-[10px] text-text-muted">Administrator</span>
      </span>
      <button
        onClick={logout}
        title="Log out"
        aria-label="Log out"
        className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:text-accent-red"
      >
        <LogOut size={14} />
      </button>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="sidebar fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-[var(--border)] bg-surface lg:flex">
        <div className="shrink-0 px-5 py-5">
          <Link href="/dashboard/ops" aria-label="ARC home">
            <ArcLogo size={26} />
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          <NavRows items={nav} pathname={pathname} />
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-[var(--border)] px-3 pb-2 pt-3">
          <NavRows items={footerNav} pathname={pathname} />
        </div>

        <div className="shrink-0 px-3 pb-2">{brandBlock}</div>
        <p className="shrink-0 px-3 pb-4 text-center text-[10px] text-text-muted">ARC v{VERSION}</p>
      </aside>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 animate-backdrop bg-[var(--overlay)] backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="animate-fade-in absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col border-r border-[var(--border)] bg-surface"
          >
            <div className="flex shrink-0 items-center justify-between px-5 py-4">
              <ArcLogo size={22} />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-text-muted hover:text-text"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
              <NavRows items={nav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              <div className="my-2 border-t border-[var(--border)] pt-2 space-y-0.5">
                <NavRows items={footerNav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </div>
            </nav>

            <div className="shrink-0 px-3 pb-3">{brandBlock}</div>
            <p className="shrink-0 px-3 pb-4 text-center text-[10px] text-text-muted">ARC v{VERSION}</p>
          </div>
        </div>
      )}

      {/* ── Mobile bottom bar ── */}
      <nav className="mobile-nav safe-area-pb fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1 py-2 lg:hidden">
        {mobileQuick.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1 transition-colors duration-150 ${
                active ? "text-[var(--brand)]" : "text-text-muted"
              }`}
            >
              <span className={`rounded-xl p-1.5 transition-colors duration-150 ${active ? "bg-[var(--brand-soft)]" : ""}`}>
                <item.icon size={16} strokeWidth={active ? 2.2 : 1.5} />
              </span>
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="flex flex-col items-center gap-1 rounded-xl px-2 py-1 text-text-muted transition-colors duration-150"
        >
          <span className="rounded-xl p-1.5"><Menu size={16} strokeWidth={1.5} /></span>
          <span className="text-[9px] font-medium">Menu</span>
        </button>
      </nav>
    </>
  );
}
