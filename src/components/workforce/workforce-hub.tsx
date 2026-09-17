"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { HubTabs } from "@/components/layout/hub-tabs";
import { NocRosterModule } from "@/components/noc/noc-roster-module";
import { WfmModule } from "@/components/wfm/wfm-module";

function WorkforceHubInner() {
  const { can } = useAuth();
  const search = useSearchParams();
  const canNoc = can("noc:read");
  const canWfm = can("wfm:read");

  const tabs = useMemo(
    () =>
      [
        {
          id: "noc",
          label: "NOC Roster",
          href: "/workforce?tab=noc",
          visible: canNoc,
        },
        {
          id: "wfm",
          label: "WFM / Absensi",
          href: "/workforce?tab=wfm",
          visible: canWfm,
        },
      ] as const,
    [canNoc, canWfm]
  );

  const visible = tabs.filter((t) => t.visible);
  const activeId = useMemo(() => {
    const raw = search.get("tab");
    if (raw && visible.some((t) => t.id === raw)) return raw;
    return visible[0]?.id ?? "noc";
  }, [search, visible]);

  if (!canNoc && !canWfm) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses workforce (`noc:read` / `wfm:read`).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <HubTabs tabs={[...tabs]} activeId={activeId} />
      {activeId === "noc" && canNoc && <NocRosterModule />}
      {activeId === "wfm" && canWfm && <WfmModule />}
    </div>
  );
}

export function WorkforceHub() {
  return (
    <Suspense fallback={<p className="text-xs text-muted-foreground">Memuat workforce…</p>}>
      <WorkforceHubInner />
    </Suspense>
  );
}
