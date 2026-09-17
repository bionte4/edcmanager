import { AppShell } from "@/components/layout/app-shell";
import { IntegrationHub } from "@/components/integration/integration-hub";

export default function IntegrationPage() {
  return (
    <AppShell
      title="System Integration"
      description="Kartu Email, SMTP, AI Insight, dan REST API — edit, test, plus CRUD API clients."
    >
      <IntegrationHub />
    </AppShell>
  );
}
