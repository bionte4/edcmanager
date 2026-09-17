import { AppShell } from "@/components/layout/app-shell";
import { DispatchModule } from "@/components/ops/dispatch-module";

export default function DispatchPage() {
  return (
    <AppShell
      title="Dispatch cerdas"
      description="Saran teknisi berdasarkan beban tiket, home RO, dan rasio 1:25 merchant."
    >
      <DispatchModule />
    </AppShell>
  );
}
