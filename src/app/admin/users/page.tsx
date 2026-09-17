import { AppShell } from "@/components/layout/app-shell";
import { AdminUsersModule } from "@/components/admin/admin-users-module";

export default function AdminUsersPage() {
  return (
    <AppShell
      title="Admin · Users & RBAC"
      description="CRUD user, assign role, dan lihat matrix permission. Hanya role dengan admin:access."
    >
      <AdminUsersModule />
    </AppShell>
  );
}
