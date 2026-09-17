"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headset, LayoutDashboard, Package, Radio, Ticket, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ticketing", label: "Ticketing", icon: Ticket },
  { href: "/noc", label: "NOC Roster", icon: Headset },
  { href: "/buffer-stock", label: "Buffer Stock", icon: Package },
  { href: "/evaluasi-vendor", label: "Evaluasi Vendor", icon: Users },
] as const;

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
              <span className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sla-safe" />
                Live monitor
              </span>
              <ThemeToggle />
            </div>
          </div>

          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
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
