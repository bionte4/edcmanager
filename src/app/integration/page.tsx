import { AppShell } from "@/components/layout/app-shell";
import { IntegrationDocs } from "@/components/integration/integration-docs";

export default function IntegrationPage() {
  return (
    <AppShell
      title="Integration API v1"
      description="REST API untuk menghubungkan ticketing / ITSM eksternal (API key + ITSM types)."
    >
      <IntegrationDocs />
    </AppShell>
  );
}
