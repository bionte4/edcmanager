import { AppShell } from "@/components/layout/app-shell";
import { WorkforceHub } from "@/components/workforce/workforce-hub";

export default function WorkforcePage() {
  return (
    <AppShell
      title="Workforce"
      description="NOC roster & WFM absensi/tukar shift — akses per tab mengikuti noc:read / wfm:read (+ manage/approve untuk CRUD)."
    >
      <WorkforceHub />
    </AppShell>
  );
}
