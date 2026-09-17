import { AppShell } from "@/components/layout/app-shell";
import { TicketingModule } from "@/components/ticketing/ticketing-module";

export default function TicketingPage() {
  return (
    <AppShell
      title="Ticketing System"
      description="Create, assign ke NOC standby, update lifecycle, dan monitor eskalasi SLA di activity log."
    >
      <TicketingModule />
    </AppShell>
  );
}
