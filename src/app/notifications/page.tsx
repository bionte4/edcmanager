import { AppShell } from "@/components/layout/app-shell";
import { NotificationsModule } from "@/components/notifications/notifications-module";

export default function NotificationsPage() {
  return (
    <AppShell
      title="Notifications · SMTP"
      description="Log email assign & eskalasi SLA. Tanpa SMTP env, pengiriman disimulasikan."
    >
      <NotificationsModule />
    </AppShell>
  );
}
