"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { HubTabs } from "@/components/layout/hub-tabs";
import { OlaPoliciesModule } from "@/components/ola/ola-policies-module";
import { TicketCategoriesModule } from "@/components/categories/ticket-categories-module";

function ConfigHubInner() {
  const { can } = useAuth();
  const search = useSearchParams();
  const canOla = can("ola:read");
  const canCat = can("category:read");

  const tabs = useMemo(
    () =>
      [
        {
          id: "ola",
          label: "OLA Policies",
          href: "/config?tab=ola",
          visible: canOla,
        },
        {
          id: "categories",
          label: "Kategori Tiket",
          href: "/config?tab=categories",
          visible: canCat,
        },
      ] as const,
    [canOla, canCat]
  );

  const visible = tabs.filter((t) => t.visible);
  const activeId = useMemo(() => {
    const raw = search.get("tab");
    if (raw && visible.some((t) => t.id === raw)) return raw;
    return visible[0]?.id ?? "ola";
  }, [search, visible]);

  if (!canOla && !canCat) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses konfigurasi (`ola:read` / `category:read`).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <HubTabs tabs={[...tabs]} activeId={activeId} />
      <p className="text-[11px] text-muted-foreground">
        CRUD mengikuti RBAC: OLA (`ola:manage`) · Kategori (`category:manage`).
      </p>
      {activeId === "ola" && canOla && <OlaPoliciesModule />}
      {activeId === "categories" && canCat && <TicketCategoriesModule />}
    </div>
  );
}

export function ConfigHub() {
  return (
    <Suspense fallback={<p className="text-xs text-muted-foreground">Memuat konfigurasi…</p>}>
      <ConfigHubInner />
    </Suspense>
  );
}
