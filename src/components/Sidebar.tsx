"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
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
        {/* Logo (text only) */}
        <div className="w-full flex items-center px-4 py-4 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold tracking-tight text-white shrink-0">ARC</span>
            <span className="logo-full text-[10px] font-medium px-1.5 py-0.5 rounded border border-white/20 text-white/50">
              v{VERSION}
            </span>
          </Link>
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

        {/* Brand */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
            <Image
              src="/bcon-icon.png"
              alt="BCON Club"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
            />
            <div className="user-text flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">BCON Club</p>
            </div>
          </div>
        </div>
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
