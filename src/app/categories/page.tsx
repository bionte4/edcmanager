import { AppShell } from "@/components/layout/app-shell";
import { TicketCategoriesModule } from "@/components/categories/ticket-categories-module";

export default function CategoriesPage() {
  return (
    <AppShell
      title="Kategori Tiket"
      description="Prioritas merchant (VIP / Non-VIP / custom) — mapping ke profil SLA. CRUD mengikuti RBAC (category:read / category:manage)."
    >
      <TicketCategoriesModule />
    </AppShell>
  );
}
