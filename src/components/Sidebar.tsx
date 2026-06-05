"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutGrid, PenLine, Calendar, BarChart3, AudioLines, Database } from "lucide-react";

// Simple user hook
function useUser() {
  const [user, setUser] = useState<{ name?: string; avatar?: string } | null>(null);
  
  useEffect(() => {
    // Try localStorage first
    try {
      const stored = localStorage.getItem('arc:user');
      if (stored) {
        setUser(JSON.parse(stored));
        return;
      }
    } catch {}
    
    // Default user
    setUser({ name: 'User' });
  }, []);
  
  return user;
}

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
  const user = useUser();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar fixed top-0 left-0 z-40 h-screen bg-surface/80 backdrop-blur-xl border-r border-[rgba(255,255,255,0.06)] flex-col hidden lg:flex overflow-hidden">
        {/* Logo (text only) */}
        <div className="w-full flex items-center px-4 py-4 shrink-0">
          <Link href="/dashboard" className="flex items-center">
            <span className="text-[15px] font-bold tracking-tight text-white shrink-0">ARC</span>
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

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                onError={(e) => {
                  // Hide broken image, show fallback
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white border border-white/10 shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="user-text flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] text-text-muted truncate">Free Plan</p>
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
