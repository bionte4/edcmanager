import { AppShell } from "@/components/layout/app-shell";
import { NocRosterModule } from "@/components/noc/noc-roster-module";

export default function NocPage() {
  return (
    <AppShell
      title="NOC Standby Roster"
      description="Siapa yang on-duty sekarang, shift pagi/siang/malam, dan directory personil command center."
    >
      <NocRosterModule />
    </AppShell>
  );
}
