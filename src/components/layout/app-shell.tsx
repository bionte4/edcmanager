"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Boxes,
  Briefcase,
  Cable,
  CalendarClock,
  ChevronDown,
  FileBarChart2,
  Gauge,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Plug,
  Radio,
  Settings2,
  Shield,
  Tags,
  Ticket,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  NAV_GROUP_LABELS,
  NAV_ITEMS,
  ROLE_PRIMARY_HREFS,
  canAccessNavItem,
  type NavIcon,
  type NavItemDef,
} from "@/config/nav.config";
import { ROLE_LABELS, type AppRole } from "@/config/rbac.config";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  executive: Briefcase,
  ticket: Ticket,
  alert: AlertTriangle,
  workforce: CalendarClock,
  inventory: Warehouse,
  reporting: FileBarChart2,
  vendor: Users,
  config: Settings2,
  integration: Cable,
  admin: Shield,
  bell: Bell,
  noc: Headset,
  wfm: CalendarClock,
  ola: Gauge,
  category: Tags,
  boxes: Boxes,
  plug: Plug,
  package: Package,
};

function isActivePath(pathname: string, href: string) {
  const path = href.split("?")[0] ?? href;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavLink({
  item,
  active,
  className,
  onClick,
}: {
  item: NavItemDef;
  active: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const Icon = ICON_MAP[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessNavItem(item, can)),
    [can]
  );

  const stripPrimary = useMemo(
    () => visibleNav.filter((i) => i.placement === "primary"),
    [visibleNav]
  );
  const stripSecondary = useMemo(
    () => visibleNav.filter((i) => i.placement === "secondary"),
    [visibleNav]
  );
  const headerNotif = useMemo(
    () => visibleNav.find((i) => i.placement === "header"),
    [visibleNav]
  );

  const primaryNav = useMemo(() => {
    const role = (user?.role ?? "NOC") as AppRole;
    const preferred = ROLE_PRIMARY_HREFS[role] ?? ROLE_PRIMARY_HREFS.NOC;
    const picked = preferred
      .map((href) => visibleNav.find((n) => n.href === href))
      .filter(Boolean) as NavItemDef[];
    if (picked.length >= 2) return picked.slice(0, 4);
    return stripPrimary.slice(0, 4);
  }, [user?.role, visibleNav, stripPrimary]);

  const moreActive = stripSecondary.some((i) => isActivePath(pathname, i.href));

  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
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

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const drawerGroups = useMemo(() => {
    const order: Array<NavItemDef["group"]> = [
      "ops",
      "logistik",
      "laporan",
      "sistem",
    ];
    return order
      .map((g) => ({
        group: g,
        label: NAV_GROUP_LABELS[g],
        items: visibleNav.filter(
          (i) => i.group === g && i.placement !== "header"
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [visibleNav]);

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
            {headerNotif && (
              <Link
                href={headerNotif.href}
                aria-label="Notifikasi"
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-md border border-border sm:h-8 sm:w-8",
                  isActivePath(pathname, headerNotif.href)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <Bell className="h-3.5 w-3.5" />
              </Link>
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

        {/* Desktop nav: primary + Lainnya */}
        <nav className="mx-auto hidden max-w-[1400px] items-center gap-0.5 px-3 pb-2 sm:px-4 md:flex">
          {stripPrimary.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              active={isActivePath(pathname, item.href)}
              className="min-h-9 rounded-md px-2.5 py-1.5 text-[11px]"
            />
          ))}

          {stripSecondary.length > 0 && (
            <div className="relative ml-0.5" ref={moreRef}>
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  moreOpen || moreActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((v) => !v)}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                Lainnya
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-40 mt-1 min-w-[12rem] rounded-md border border-border bg-background p-1 shadow-lg"
                >
                  {stripSecondary.map((item) => {
                    const Icon = ICON_MAP[item.icon];
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        role="menuitem"
                        className={cn(
                          "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-xs font-medium",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                        )}
                        onClick={() => setMoreOpen(false)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Mobile drawer — grouped */}
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
            {drawerGroups.map((g) => (
              <div key={g.group} className="mb-3">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map((item) => {
                  const Icon = ICON_MAP[item.icon];
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            {headerNotif && (
              <Link
                href={headerNotif.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
                  isActivePath(pathname, headerNotif.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
                onClick={() => setDrawerOpen(false)}
              >
                <Bell className="h-4 w-4" />
                {headerNotif.label}
              </Link>
            )}
          </nav>
        </aside>
      </div>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground md:line-clamp-none line-clamp-2">
            {description}
          </p>
        </div>
        {children}
      </main>

      {/* Mobile bottom nav */}
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
          {primaryNav.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate px-0.5">
                  {item.shortLabel ?? item.label}
                </span>
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
