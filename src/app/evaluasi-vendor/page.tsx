import { AppShell } from "@/components/layout/app-shell";
import { VendorEvaluationModule } from "@/components/vendors/vendor-evaluation-module";

export default function VendorsPage() {
  return (
    <AppShell
      title="Evaluasi Vendor"
      description="Ringkasan performa Vendor 1 vs Vendor 2: SLA compliance, kecepatan resolusi, dan kendala operasional."
    >
      <VendorEvaluationModule />
    </AppShell>
  );
}
