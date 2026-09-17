import { AppShell } from "@/components/layout/app-shell";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TicketTable } from "@/components/dashboard/ticket-table";
import { DashboardAiBriefing } from "@/components/dashboard/ai-briefing";
import {
  DEMO_AS_OF,
  MOCK_BUFFER_STOCK,
  MOCK_TICKETS,
  buildDashboardKpis,
  enrichTickets,
} from "@/data/dashboard";

export default function DashboardPage() {
  const tickets = enrichTickets(MOCK_TICKETS, DEMO_AS_OF);
  const kpis = buildDashboardKpis(tickets, MOCK_BUFFER_STOCK);

  return (
    <AppShell
      title="Dashboard Operasional"
      description="KPI real-time, eskalasi SLA 80%, buffer stock, dan AI shift briefing."
    >
      <KpiGrid kpis={kpis} />
      <DashboardAiBriefing dashboardTickets={tickets} />
      <TicketTable tickets={tickets} />
    </AppShell>
  );
}
