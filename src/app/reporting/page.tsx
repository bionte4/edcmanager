import { AppShell } from "@/components/layout/app-shell";
import { ReportingModule } from "@/components/reporting/reporting-module";

export default function ReportingPage() {
  return (
    <AppShell
      title="Reporting"
      description="Laporan operasional SLA / OLA, vendor, buffer stock, dan WFM. Akses mengikuti RBAC (report:read / report:export)."
    >
      <ReportingModule />
    </AppShell>
  );
}
