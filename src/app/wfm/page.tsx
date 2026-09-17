import { AppShell } from "@/components/layout/app-shell";
import { WfmModule } from "@/components/wfm/wfm-module";

export default function WfmPage() {
  return (
    <AppShell
      title="Workforce Management (WFM)"
      description="Kehadiran NOC/L1 dari login sesuai roster, plus approval tukar shift."
    >
      <WfmModule />
    </AppShell>
  );
}
