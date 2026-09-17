import { AppShell } from "@/components/layout/app-shell";
import { ConfigHub } from "@/components/config/config-hub";

export default function ConfigPage() {
  return (
    <AppShell
      title="Konfigurasi"
      description="OLA policies & kategori tiket (VIP/Non-VIP/custom) — CRUD terpisah per permission."
    >
      <ConfigHub />
    </AppShell>
  );
}
