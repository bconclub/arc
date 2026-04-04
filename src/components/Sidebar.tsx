"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, PenLine, Calendar, BarChart3, AudioLines, Database } from "lucide-react";
import { VERSION } from "@/lib/version";

const navItems = [
  { label: "Feed", href: "/dashboard/feed", icon: LayoutGrid },
  { label: "Write", href: "/dashboard/write", icon: PenLine },
  { label: "Schedule", href: "/dashboard/schedule", icon: Calendar },
  { label: "Results", href: "/dashboard/results", icon: BarChart3 },
  { label: "Voice", href: "/dashboard/voice", icon: AudioLines },
  { label: "Sources", href: "/dashboard/sources", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar fixed top-0 left-0 z-40 h-screen bg-surface/80 backdrop-blur-xl border-r border-[rgba(255,255,255,0.06)] flex-col hidden lg:flex overflow-hidden">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 gap-3 shrink-0">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-black leading-none">A</span>
          </div>
          <div className="flex items-center logo-full">
            <span className="text-sm font-semibold tracking-tight text-white">
              ARC
            </span>
            <span 
              className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-white/30 ml-1.5"
              style={{ opacity: 0.6 }}
            >
              v{VERSION}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-white text-black font-medium shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-white/[0.04]"
                }`}
              >
                <item.icon size={17} strokeWidth={isActive ? 2 : 1.6} className="shrink-0" />
                <span className="nav-label text-[13px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-50 lg:hidden flex items-center justify-around px-1 py-2 safe-area-pb">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? "text-white"
                  : "text-text-muted"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? "bg-white/10" : ""}`}>
                <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              </div>
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
