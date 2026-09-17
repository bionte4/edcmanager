"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { HubTabs } from "@/components/layout/hub-tabs";
import { EscalationInboxModule } from "@/components/liaison/escalation-inbox-module";
import { HandoverModule } from "@/components/liaison/handover-module";
import { LoRosterModule } from "@/components/liaison/lo-roster-module";
import { NocRosterModule } from "@/components/noc/noc-roster-module";
import { WfmModule } from "@/components/wfm/wfm-module";

function WorkforceHubInner() {
  const { can } = useAuth();
  const search = useSearchParams();
  const canNoc = can("noc:read");
  const canWfm = can("wfm:read");
  const canLo = can("liaison:read");
  const canEscalate = can("liaison:escalate");

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
          id: "lo",
          label: "LO / DOG",
          href: "/workforce?tab=lo",
          visible: canLo,
        },
        {
          id: "handover",
          label: "Handover",
          href: "/workforce?tab=handover",
          visible: canLo,
        },
        {
          id: "escalation",
          label: "Inbox Eskalasi",
          href: "/workforce?tab=escalation",
          visible: canLo || canEscalate,
        },
        {
          id: "wfm",
          label: "WFM / Absensi",
          href: "/workforce?tab=wfm",
          visible: canWfm,
        },
      ] as const,
    [canNoc, canWfm, canLo, canEscalate]
  );

  const visible = tabs.filter((t) => t.visible);
  const activeId = useMemo(() => {
    const raw = search.get("tab");
    if (raw && visible.some((t) => t.id === raw)) return raw;
    return visible[0]?.id ?? "noc";
  }, [search, visible]);

  if (!canNoc && !canWfm && !canLo && !canEscalate) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses workforce (`noc:read` / `wfm:read` / `liaison:read`).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <HubTabs tabs={[...tabs]} activeId={activeId} />
      {activeId === "noc" && canNoc && <NocRosterModule />}
      {activeId === "lo" && canLo && <LoRosterModule />}
      {activeId === "handover" && canLo && <HandoverModule />}
      {activeId === "escalation" && (canLo || canEscalate) && (
        <EscalationInboxModule />
      )}
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
