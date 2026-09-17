import { AppShell } from "@/components/layout/app-shell";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TicketTable } from "@/components/dashboard/ticket-table";
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
      description="KPI real-time, eskalasi SLA 80%, dan status buffer stock minimal 10% per RO."
    >
      <KpiGrid kpis={kpis} />
      <TicketTable tickets={tickets} />
    </AppShell>
  );
}
