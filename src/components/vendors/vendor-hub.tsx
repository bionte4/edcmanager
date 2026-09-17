"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { HubTabs } from "@/components/layout/hub-tabs";
import { VendorsModule } from "@/components/vendors/vendors-module";
import { VendorEvaluationModule } from "@/components/vendors/vendor-evaluation-module";
import type { VendorMonthlyMetrics } from "@/data/vendors";

const TABS = [
  { id: "master", label: "Master Vendor", href: "/vendors?tab=master" },
  { id: "evaluasi", label: "Evaluasi", href: "/vendors?tab=evaluasi" },
] as const;

function VendorHubInner() {
  const { can } = useAuth();
  const search = useSearchParams();
  const canRead = can("vendor:read");
  const canManage = can("vendor:manage");
  const [metrics, setMetrics] = useState<VendorMonthlyMetrics[] | null>(null);

  const visibleTabs = useMemo(() => {
    // Master tab: show if manage OR always for read (GM can view list too)
    return TABS.filter((t) => {
      if (t.id === "master") return canRead;
      return canRead;
    });
  }, [canRead]);

  const activeId = useMemo(() => {
    const raw = search.get("tab") ?? (canManage ? "master" : "evaluasi");
    if (visibleTabs.some((t) => t.id === raw)) return raw;
    return visibleTabs[0]?.id ?? "evaluasi";
  }, [search, visibleTabs, canManage]);

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/vendors?view=metrics", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { metrics?: VendorMonthlyMetrics[] };
      setMetrics(data.metrics ?? []);
    } catch {
      setMetrics([]);
    }
  }, []);

  useEffect(() => {
    if (activeId === "evaluasi") void loadMetrics();
  }, [activeId, loadMetrics]);

  if (!canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses vendor (`vendor:read`).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <HubTabs tabs={[...visibleTabs]} activeId={activeId} />
      <p className="text-[11px] text-muted-foreground">
        Master data (`vendor:manage`) · Evaluasi performa (`vendor:read`).
      </p>
      {activeId === "master" && <VendorsModule />}
      {activeId === "evaluasi" && (
        <VendorEvaluationModule vendors={metrics ?? undefined} />
      )}
    </div>
  );
}

export function VendorHub() {
  return (
    <Suspense fallback={<p className="text-xs text-muted-foreground">Memuat vendor…</p>}>
      <VendorHubInner />
    </Suspense>
  );
}
