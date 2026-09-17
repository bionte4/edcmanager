import { AppShell } from "@/components/layout/app-shell";
import { TicketingModule } from "@/components/ticketing/ticketing-module";

export default function TicketingPage() {
  return (
    <AppShell
      title="Ticketing System"
      description="Create Incident/Request/Problem/Change, assign NOC, link incident→problem, monitor SLA per tipe."
    >
      <TicketingModule />
    </AppShell>
  );
}
