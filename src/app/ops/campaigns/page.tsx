import { AppShell } from "@/components/layout/app-shell";
import { CampaignsModule } from "@/components/ops/campaigns-module";

export default function CampaignsPage() {
  return (
    <AppShell
      title="PM & Peak Season"
      description="Kalender Preventive Maintenance bulanan dan playbook intensifikasi Natal / Tahun Baru / Lebaran."
    >
      <CampaignsModule />
    </AppShell>
  );
}
