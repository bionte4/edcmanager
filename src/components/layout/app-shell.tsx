"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  Cable,
  CalendarClock,
  FileBarChart2,
  Gauge,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Radio,
  Shield,
  Tags,
  Ticket,
  Users,
  X,
  Briefcase,
  Plug,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import type { Permission } from "@/config/rbac.config";
import { ROLE_LABELS } from "@/config/rbac.config";
import { cn } from "@/lib/utils";

const NAV: Array<{
  href: string;
  label: string;
  shortLabel?: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
}> = [
  { href: "/", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, permission: "dashboard:read" },
  { href: "/executive", label: "Executive", shortLabel: "Exec", icon: Briefcase, permission: "executive:read" },
  { href: "/ticketing", label: "Ticketing", shortLabel: "Tiket", icon: Ticket, permission: "ticket:read" },
  { href: "/noc", label: "NOC Roster", shortLabel: "NOC", icon: Headset, permission: "noc:read" },
  { href: "/wfm", label: "WFM", icon: CalendarClock, permission: "wfm:read" },
  { href: "/ola", label: "OLA", icon: Gauge, permission: "ola:read" },
  { href: "/categories", label: "Kategori", shortLabel: "Kat.", icon: Tags, permission: "category:read" },
  { href: "/reporting", label: "Reporting", shortLabel: "Report", icon: FileBarChart2, permission: "report:read" },
  { href: "/assets", label: "Assets", icon: Boxes, permission: "inventory:read" },
  { href: "/peripherals", label: "Peripherals", shortLabel: "Perif.", icon: Plug, permission: "inventory:read" },
  { href: "/buffer-stock", label: "Buffer Stock", shortLabel: "Buffer", icon: Package, permission: "inventory:read" },
  { href: "/evaluasi-vendor", label: "Evaluasi Vendor", shortLabel: "Vendor", icon: Users, permission: "vendor:read" },
  { href: "/notifications", label: "Notifications", shortLabel: "Notif", icon: Bell, permission: "notification:read" },
  { href: "/integration", label: "Integrations", shortLabel: "API", icon: Cable, permission: "integration:read" },
  { href: "/admin/users", label: "Admin Users", shortLabel: "Admin", icon: Shield, permission: "admin:access" },
];

const PRIMARY_HREFS = ["/", "/ticketing", "/wfm", "/notifications"] as const;

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, can, logout, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleNav = useMemo(
    () => NAV.filter((item) => can(item.permission)),
    [can]
  );

  const primaryNav = useMemo(() => {
    const picked = PRIMARY_HREFS.map((href) =>
      visibleNav.find((n) => n.href === href)
    ).filter(Boolean) as typeof visibleNav;
    return picked.slice(0, 4);
  }, [visibleNav]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 md:hidden"
              aria-label="Buka menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Radio className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight tracking-wide">
                EDC Manager
              </p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                Operations · SLA / OLA
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!loading && user && (
              <span className="hidden max-w-[200px] truncate rounded-md border border-border bg-card px-2 py-1 text-[11px] lg:inline-flex">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground">
                  &nbsp;· {ROLE_LABELS[user.role]}
                </span>
              </span>
            )}
            <ThemeToggle />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 min-w-10 px-2 sm:h-8 sm:px-3"
              onClick={() => void logout()}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Desktop / tablet top nav */}
        <nav className="mx-auto hidden max-w-[1400px] flex-wrap gap-0.5 px-3 pb-2 sm:px-4 md:flex">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            drawerOpen ? "opacity-100" : "opacity-0"
          )}
          aria-label="Tutup menu"
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-border bg-background shadow-xl transition-transform duration-200",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <div>
              <p className="text-sm font-semibold">Menu</p>
              {!loading && user && (
                <p className="text-[11px] text-muted-foreground">
                  {user.name} · {ROLE_LABELS[user.role]}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label="Tutup"
              onClick={() => setDrawerOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {visibleNav.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          <p className="text-xs text-muted-foreground md:line-clamp-none line-clamp-2">
            {description}
          </p>
        </div>
        {children}
      </main>

      {/* Mobile bottom nav — primary + More */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navigasi utama"
      >
        <div
          className="mx-auto grid max-w-[1400px] gap-0.5 px-1 py-1"
          style={{
            gridTemplateColumns: `repeat(${Math.max(primaryNav.length + 1, 2)}, minmax(0, 1fr))`,
          }}
        >
          {primaryNav.map(({ href, shortLabel, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate px-0.5">{shortLabel ?? label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium",
              drawerOpen ? "bg-primary/10 text-primary" : "text-muted-foreground"
            )}
            onClick={() => setDrawerOpen(true)}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
