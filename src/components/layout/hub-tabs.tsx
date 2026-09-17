"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface HubTab {
  id: string;
  label: string;
  href: string;
  visible?: boolean;
}

export function HubTabs({
  tabs,
  activeId,
}: {
  tabs: HubTab[];
  activeId: string;
}) {
  const visible = tabs.filter((t) => t.visible !== false);

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
      {visible.map((tab) => {
        const active = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "inline-flex min-h-9 items-center rounded-md px-3 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
