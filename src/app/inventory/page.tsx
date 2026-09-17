import { AppShell } from "@/components/layout/app-shell";
import { InventoryHub } from "@/components/inventory/inventory-hub";

export default function InventoryPage() {
  return (
    <AppShell
      title="Inventori"
      description="Perangkat EDC (serial), peripheral/consumable, dan buffer stock per RO — CRUD mengikuti inventory:read / inventory:mutate."
    >
      <InventoryHub />
    </AppShell>
  );
}
