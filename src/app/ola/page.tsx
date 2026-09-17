import { AppShell } from "@/components/layout/app-shell";
import { OlaPoliciesModule } from "@/components/ola/ola-policies-module";

export default function OlaPage() {
  return (
    <AppShell
      title="OLA Policies"
      description="Operational Level Agreement — jam internal Acknowledge & Dispatch. CRUD mengikuti RBAC (ola:read / ola:manage)."
    >
      <OlaPoliciesModule />
    </AppShell>
  );
}
