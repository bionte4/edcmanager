"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { HubTabs } from "@/components/layout/hub-tabs";
import { AssetManagementModule } from "@/components/assets/asset-management-module";
import { PeripheralsModule } from "@/components/peripherals/peripherals-module";
import { BufferStockModule } from "@/components/buffer-stock/buffer-stock-module";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import { REGIONAL_OFFICES } from "@/config/assets.config";
import type { BufferStockRow } from "@/data/dashboard";
import type { EdcAsset } from "@/data/assets-store";

const TABS = [
  { id: "devices", label: "Perangkat EDC", href: "/inventory?tab=devices" },
  { id: "peripherals", label: "Peripheral", href: "/inventory?tab=peripherals" },
  { id: "buffer", label: "Buffer Stock", href: "/inventory?tab=buffer" },
] as const;

function bufferFromAssets(assets: EdcAsset[]): BufferStockRow[] {
  return REGIONAL_OFFICES.map((ro) => {
    const rows = assets.filter((a) => a.regionalOffice === ro);
    const totalUnits = rows.length;
    const bufferUnits = rows.filter((a) => a.status === "BUFFER").length;
    const deployedUnits = rows.filter((a) => a.status === "DEPLOYED").length;
    const idleUnits = rows.filter((a) => a.status === "IDLE").length;
    const bufferPercent =
      totalUnits > 0 ? (bufferUnits / totalUnits) * 100 : 0;
    return {
      regionalOffice: ro,
      totalUnits,
      bufferUnits,
      deployedUnits,
      idleUnits,
      bufferPercent,
      belowThreshold: bufferPercent < BUFFER_STOCK_MIN_PERCENT,
    };
  });
}

function InventoryHubInner() {
  const { can } = useAuth();
  const search = useSearchParams();
  const canInv = can("inventory:read");
  const [bufferRows, setBufferRows] = useState<BufferStockRow[]>([]);

  const activeId = useMemo(() => {
    const raw = search.get("tab") ?? "devices";
    if (TABS.some((t) => t.id === raw)) return raw;
    return "devices";
  }, [search]);

  const loadBuffer = useCallback(async () => {
    try {
      const res = await fetch("/api/assets", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { assets?: EdcAsset[] };
      setBufferRows(bufferFromAssets(data.assets ?? []));
    } catch {
      /* empty */
    }
  }, []);

  useEffect(() => {
    if (activeId === "buffer") void loadBuffer();
  }, [activeId, loadBuffer]);

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
      {activeId === "buffer" && <BufferStockModule initialRows={bufferRows} />}
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
