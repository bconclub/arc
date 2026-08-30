"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Boxes, FolderKanban, Wallet, Radio,
  BarChart3, Users, Radar, Rss, CalendarDays, PenLine,
  Palette, Bot, TrendingUp, Plug, Settings, LogOut, X, IndianRupee,
  Target, ShieldCheck, AlertTriangle, Rocket, Send,
} from "lucide-react";
import { VERSION } from "@/lib/version";
import { ArcLogo, ArcMark } from "@/components/ArcLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Radar;
  exact?: boolean;
};

/**
 * A heading with its items. The heading is a label, not a link.
 *
 * Operations used to be a clickable parent that revealed its children only once
 * you were already inside it, so the way to find People was to guess that it
 * lived under Operations and click through. Sections are always open now: the
 * rail is longer and everything in it is visible at once, which is the trade
 * worth making on a list this size.
 */
type NavSection = { heading?: string; items: NavItem[] };

const nav: NavSection[] = [
  { items: [{ label: "Dashboard", href: "/dashboard/ops", icon: LayoutDashboard, exact: true }] },
  {
    heading: "Operations",
    items: [
      { label: "Brands", href: "/dashboard/brands", icon: Boxes },
      { label: "Projects", href: "/dashboard/ops/projects", icon: FolderKanban },
      { label: "People", href: "/dashboard/ops/people", icon: Users },
      { label: "Proposals", href: "/dashboard/ops/proposals", icon: FileText },
    ],
  },
  {
    heading: "Money",
    items: [
      { label: "Invoices", href: "/dashboard/ops/money", icon: Wallet },
      { label: "Revenue", href: "/dashboard/analytics", icon: IndianRupee },
    ],
  },
  {
    heading: "Signals",
    items: [
      { label: "Radar", href: "/dashboard/ops/alerts", icon: Radar },
      { label: "Feed", href: "/dashboard/feed", icon: Radio },
      { label: "Sources", href: "/dashboard/sources", icon: Rss },
      { label: "Connections", href: "/dashboard/connections", icon: Plug },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "Content running", href: "/dashboard/schedule", icon: CalendarDays },
      { label: "Our content", href: "/dashboard/write", icon: PenLine },
      { label: "Style", href: "/dashboard/style", icon: Palette },
      { label: "ARC Agent", href: "/dashboard/arc", icon: Bot },
    ],
  },
  {
    heading: "Analytics",
    items: [
      { label: "Results", href: "/dashboard/results", icon: BarChart3 },
      { label: "Brand metrics", href: "/dashboard/brand/metrics", icon: TrendingUp },
      { label: "Calendar", href: "/dashboard/brand/calendar", icon: CalendarDays },
    ],
  },
  {
    heading: "Strategy",
    items: [
      { label: "GTM", href: "/dashboard/gtm", icon: Target, exact: true },
      { label: "Outreach", href: "/dashboard/outreach", icon: Send, exact: true },
    ],
  },
  {
    heading: "PROXe",
    items: [
      { label: "Briefs", href: "/dashboard/proxe", icon: ShieldCheck, exact: true },
      { label: "Issues", href: "/dashboard/proxe/issues", icon: AlertTriangle },
      { label: "Updates", href: "/dashboard/proxe/updates", icon: Rocket },
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

/**
 * Sits against the logo so the running version is visible at a glance, it used
 * to be footer text, below the fold on a short viewport, which is no use when
 * the point is knowing what you're looking at.
 */
function VersionTag() {
  return (
    <span
      title={`ARC v${VERSION}`}
      className="select-none rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 font-mono text-[9.5px] leading-none text-text-muted"
    >
      v{VERSION}
    </span>
  );
}

function rowCls(active: boolean) {
  return [
    "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors duration-150",
    active
      ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand-text)]"
      : "text-text-muted hover:bg-[var(--glow-white)] hover:text-text",
  ].join(" ");
}

function NavRows({ items, pathname, onNavigate }: {
  items: NavItem[]; pathname: string; onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={rowCls(active)}
          >
            <item.icon size={17} strokeWidth={active ? 2.2 : 1.7} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function NavSections({ sections, pathname, onNavigate }: {
  sections: NavSection[]; pathname: string; onNavigate?: () => void;
}) {
  return (
    <>
      {sections.map((section, i) => (
        <div key={section.heading ?? `section-${i}`} className={section.heading ? "pt-4 first:pt-0" : ""}>
          {section.heading && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted opacity-70">
              {section.heading}
            </p>
          )}
          <div className="space-y-0.5">
            <NavRows items={section.items} pathname={pathname} onNavigate={onNavigate} />
          </div>
        </div>
      ))}
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
      {/* Theme toggle lives here now the TopBar is gone; it was the only control
          in that bar worth keeping. */}
      <ThemeToggle />
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
        <div className="flex shrink-0 items-center gap-2 px-5 py-5">
          <Link href="/dashboard/ops" aria-label="ARC home" className="inline-flex">
            <ArcLogo size={24} />
          </Link>
          <VersionTag />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-2">
          <NavSections sections={nav} pathname={pathname} />
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-[var(--border)] px-3 pb-2 pt-3">
          <NavRows items={footerNav} pathname={pathname} />
        </div>

        <div className="shrink-0 px-3 pb-4">{brandBlock}</div>
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
              <span className="flex items-center gap-2">
                <ArcLogo size={20} />
                <VersionTag />
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-text-muted hover:text-text"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 pb-4">
              <NavSections sections={nav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              <div className="my-2 border-t border-[var(--border)] pt-2 space-y-0.5">
                <NavRows items={footerNav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </div>
            </nav>

            <div className="shrink-0 px-3 pb-4">{brandBlock}</div>
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
                active ? "text-[var(--brand-text)]" : "text-text-muted"
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
          {/* Menu closed: the icon mark stands in for the wordmark the drawer shows. */}
          <span className="flex h-[28px] items-center rounded-xl p-1.5"><ArcMark size={15} /></span>
          <span className="text-[9px] font-medium">Menu</span>
        </button>
      </nav>
    </>
  );
}
