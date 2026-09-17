import { AppShell } from "@/components/layout/app-shell";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import {
  buildExecutiveSummary,
  emptyExecutiveSummary,
} from "@/data/executive-dashboard";
import { DEMO_AS_OF } from "@/data/dashboard";

export const dynamic = "force-dynamic";

export default async function ExecutivePage() {
  let summary;
  try {
    summary = await buildExecutiveSummary(DEMO_AS_OF);
  } catch {
    summary = emptyExecutiveSummary(DEMO_AS_OF);
  }

  return (
    <AppShell
      title="Executive Dashboard"
      description="GM / BOD — SLA nasional, risiko penalti, buffer health, progres deployment 3 tahun."
    >
      <ExecutiveDashboard summary={summary} />
    </AppShell>
  );
}
