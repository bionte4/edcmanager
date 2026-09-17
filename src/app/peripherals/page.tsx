import { AppShell } from "@/components/layout/app-shell";
import { PeripheralsModule } from "@/components/peripherals/peripherals-module";

export default function PeripheralsPage() {
  return (
    <AppShell
      title="Peripheral Inventory"
      description="Kabel, kertas, SIM, spare part — stok per RO + alert min-stock. Terpisah dari unit EDC (serial) di Assets."
    >
      <PeripheralsModule />
    </AppShell>
  );
}
