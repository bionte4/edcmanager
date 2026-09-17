"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Package,
  Radio,
  Shield,
  Ticket,
  Users,
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
  icon: typeof LayoutDashboard;
  permission: Permission;
}> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
  { href: "/ticketing", label: "Ticketing", icon: Ticket, permission: "ticket:read" },
  { href: "/noc", label: "NOC Roster", icon: Headset, permission: "noc:read" },
  { href: "/wfm", label: "WFM", icon: CalendarClock, permission: "wfm:read" },
  { href: "/ola", label: "OLA", icon: Gauge, permission: "ola:read" },
  { href: "/reporting", label: "Reporting", icon: FileBarChart2, permission: "report:read" },
  { href: "/assets", label: "Assets", icon: Boxes, permission: "inventory:read" },
  { href: "/buffer-stock", label: "Buffer Stock", icon: Package, permission: "inventory:read" },
  { href: "/evaluasi-vendor", label: "Evaluasi Vendor", icon: Users, permission: "vendor:read" },
  { href: "/notifications", label: "Notifications", icon: Bell, permission: "notification:read" },
  { href: "/integration", label: "Integrations", icon: Cable, permission: "integration:read" },
  { href: "/admin/users", label: "Admin Users", icon: Shield, permission: "admin:access" },
];

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

  const visibleNav = NAV.filter((item) => can(item.permission));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card">
                <Radio className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight tracking-wide">EDC Manager</p>
                <p className="hidden text-[11px] text-muted-foreground sm:block">
                  Operations Command Center · SLA / OLA & Buffer Stock
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!loading && user && (
                <span className="hidden items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] sm:inline-flex">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-muted-foreground">· {ROLE_LABELS[user.role]}</span>
                </span>
              )}
              <ThemeToggle />
              <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut className="h-3 w-3" />
                Logout
              </Button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-0.5">
            {visibleNav.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
