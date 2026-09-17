import { AppShell } from "@/components/layout/app-shell";
import { VendorHub } from "@/components/vendors/vendor-hub";

export default function VendorsPage() {
  return (
    <AppShell
      title="Vendor"
      description="Master data vendor (kontak, tipe, kuota) dan evaluasi performa SLA / uptime."
    >
      <VendorHub />
    </AppShell>
  );
}
