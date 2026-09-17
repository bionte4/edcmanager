import {
  Activity,
  AlertTriangle,
  Package,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/utils";
import type { DashboardKpis } from "@/data/dashboard";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "neutral" | "ok" | "warn" | "danger";
}

function KpiCard({ title, value, hint, icon: Icon, tone = "neutral" }: KpiCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle>{title}</CardTitle>
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            tone === "ok" && "text-sla-safe",
            tone === "warn" && "text-sla-warning",
            tone === "danger" && "text-sla-breached",
            tone === "neutral" && "text-muted-foreground"
          )}
        />
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  const uptimeTone =
    kpis.uptimePercent >= kpis.uptimeTarget
      ? "ok"
      : kpis.uptimePercent >= kpis.uptimeTarget - 0.05
        ? "warn"
        : "danger";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Tiket Aktif"
        value={String(kpis.activeTickets)}
        hint="Corrective maintenance terbuka"
        icon={Ticket}
      />
      <KpiCard
        title="Uptime Real-time"
        value={formatPercent(kpis.uptimePercent)}
        hint={`Target ${formatPercent(kpis.uptimeTarget, 1)}`}
        icon={Activity}
        tone={uptimeTone}
      />
      <KpiCard
        title="Mendekati / Breach SLA"
        value={String(kpis.approachingBreach)}
        hint="Warning (≥80%) atau Breached"
        icon={AlertTriangle}
        tone={kpis.approachingBreach > 0 ? "warn" : "ok"}
      />
      <KpiCard
        title="Buffer Stock RO"
        value={`${kpis.bufferOkCount}/${kpis.bufferTotalRo}`}
        hint={`Min ${kpis.bufferMinPercent}% per Regional Office`}
        icon={Package}
        tone={kpis.bufferHealthy ? "ok" : "danger"}
      />
    </div>
  );
}
