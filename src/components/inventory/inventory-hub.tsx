"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { HubTabs } from "@/components/layout/hub-tabs";
import { AssetManagementModule } from "@/components/assets/asset-management-module";
import { PeripheralsModule } from "@/components/peripherals/peripherals-module";
import { BufferStockModule } from "@/components/buffer-stock/buffer-stock-module";
import { MOCK_BUFFER_STOCK } from "@/data/dashboard";

const TABS = [
  { id: "devices", label: "Perangkat EDC", href: "/inventory?tab=devices" },
  { id: "peripherals", label: "Peripheral", href: "/inventory?tab=peripherals" },
  { id: "buffer", label: "Buffer Stock", href: "/inventory?tab=buffer" },
] as const;

function InventoryHubInner() {
  const { can } = useAuth();
  const search = useSearchParams();
  const canInv = can("inventory:read");

  const activeId = useMemo(() => {
    const raw = search.get("tab") ?? "devices";
    if (TABS.some((t) => t.id === raw)) return raw;
    return "devices";
  }, [search]);

  if (!canInv) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses inventori (`inventory:read`).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <HubTabs tabs={[...TABS]} activeId={activeId} />
      {activeId === "devices" && <AssetManagementModule />}
      {activeId === "peripherals" && <PeripheralsModule />}
      {activeId === "buffer" && (
        <BufferStockModule initialRows={MOCK_BUFFER_STOCK} />
      )}
    </div>
  );
}

export function InventoryHub() {
  return (
    <Suspense fallback={<p className="text-xs text-muted-foreground">Memuat inventori…</p>}>
      <InventoryHubInner />
    </Suspense>
  );
}
