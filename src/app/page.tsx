import { AppShell } from "@/components/layout/app-shell";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TicketTable } from "@/components/dashboard/ticket-table";
import { DashboardAiBriefing } from "@/components/dashboard/ai-briefing";
import {
  DEMO_AS_OF,
  buildDashboardKpis,
  enrichTickets,
  type BufferStockRow,
  type DashboardTicket,
} from "@/data/dashboard";
import { listOpsTickets } from "@/data/tickets-store";
import { listAssets } from "@/data/assets-store";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import { REGIONAL_OFFICES } from "@/config/assets.config";

function bufferFromAssets(
  assets: Awaited<ReturnType<typeof listAssets>>
): BufferStockRow[] {
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

export default async function DashboardPage() {
  let dashboardTickets: DashboardTicket[] = [];
  let buffer: BufferStockRow[] = [];

  try {
    const [ops, assets] = await Promise.all([listOpsTickets(), listAssets()]);
    dashboardTickets = ops.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      merchantId: t.merchantId,
      location: t.location,
      category: t.category,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      vendorName: t.vendorName,
      regionalOffice: "RO Jakarta 1",
    }));
    buffer = bufferFromAssets(assets);
  } catch {
    /* DB unavailable — empty dashboard */
  }

  const tickets = enrichTickets(dashboardTickets, DEMO_AS_OF);
  const kpis = buildDashboardKpis(tickets, buffer);

  return (
    <AppShell
      title="Dashboard Operasional"
      description="KPI dari database (seed dummy) — eskalasi SLA 80%, buffer stock, AI briefing."
    >
      <KpiGrid kpis={kpis} />
      <DashboardAiBriefing dashboardTickets={tickets} />
      <TicketTable tickets={tickets} />
    </AppShell>
  );
}
