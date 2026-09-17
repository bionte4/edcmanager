"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cable,
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
  { href: "/buffer-stock", label: "Buffer Stock", icon: Package, permission: "inventory:read" },
  { href: "/evaluasi-vendor", label: "Evaluasi Vendor", icon: Users, permission: "vendor:read" },
  { href: "/integration", label: "Integration API", icon: Cable, permission: "dashboard:read" },
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
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card">
                <Radio className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide">EDC Manager</p>
                <p className="text-xs text-muted-foreground">
                  Operations Command Center · SLA & Buffer Stock
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!loading && user && (
                <span className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs sm:inline-flex">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-muted-foreground">· {ROLE_LABELS[user.role]}</span>
                </span>
              )}
              <ThemeToggle />
              <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1">
            {visibleNav.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
