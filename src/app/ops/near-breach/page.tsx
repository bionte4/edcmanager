import { AppShell } from "@/components/layout/app-shell";
import { NearBreachModule } from "@/components/ops/near-breach-module";

export default function NearBreachPage() {
  return (
    <AppShell
      title="Near-breach 16:00"
      description="Audit harian tiket mendekati/breach SLA — realokasi sebelum penalti. Clock-stop untuk hold BRI."
    >
      <NearBreachModule />
    </AppShell>
  );
}
