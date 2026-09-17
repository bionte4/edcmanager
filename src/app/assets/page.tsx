import { AppShell } from "@/components/layout/app-shell";
import { AssetManagementModule } from "@/components/assets/asset-management-module";

export default function AssetsPage() {
  return (
    <AppShell
      title="Asset Management"
      description="Inventaris unit EDC per serial — status Buffer/Deployed/Idle, mutasi, dan riwayat."
    >
      <AssetManagementModule />
    </AppShell>
  );
}
