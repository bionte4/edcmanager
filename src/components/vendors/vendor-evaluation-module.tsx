import { Activity, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MOCK_VENDOR_METRICS,
  UPTIME_TARGET_PERCENT,
  buildVendorComparison,
  type VendorMonthlyMetrics,
} from "@/data/vendors";
import { cn, formatPercent } from "@/lib/utils";

function VendorSummaryCard({ vendor }: { vendor: VendorMonthlyMetrics }) {
  const slaOk = vendor.slaComplianceRate >= 95;
  const uptimeOk = vendor.uptimePercent >= UPTIME_TARGET_PERCENT;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-foreground">{vendor.vendorName}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {vendor.type} · {vendor.monthLabel}
          </p>
        </div>
        <Badge variant={slaOk && uptimeOk ? "safe" : "warning"}>
          {slaOk && uptimeOk ? "On Target" : "At Risk"}
        </Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Metric
          icon={ShieldCheck}
          label="SLA Compliance"
          value={formatPercent(vendor.slaComplianceRate, 1)}
          tone={slaOk ? "ok" : "warn"}
        />
        <Metric
          icon={Clock}
          label="Avg Resolution"
          value={`${vendor.avgResolutionHours.toFixed(1)} jam`}
        />
        <Metric
          icon={AlertTriangle}
          label="Kendala Operasional"
          value={String(vendor.operationalIssues)}
          tone={vendor.operationalIssues > 5 ? "warn" : "ok"}
        />
        <Metric
          icon={Activity}
          label="Uptime"
          value={formatPercent(vendor.uptimePercent)}
          tone={uptimeOk ? "ok" : "danger"}
        />
        <div className="col-span-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Alokasi / Deployed: </span>
          <span className="font-mono font-medium">
            {vendor.deployedUnits}/{vendor.allocationQuota}
          </span>
          <span className="text-muted-foreground">
            {" "}
            · Breach {vendor.breachedTickets}/{vendor.totalTickets} tiket
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "ok" && "text-sla-safe",
            tone === "warn" && "text-sla-warning",
            tone === "danger" && "text-sla-breached"
          )}
        />
        {label}
      </div>
      <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

export function VendorEvaluationModule({
  vendors = MOCK_VENDOR_METRICS,
}: {
  vendors?: VendorMonthlyMetrics[];
}) {
  const comparison = buildVendorComparison(vendors);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {vendors.map((vendor) => (
          <VendorSummaryCard key={vendor.vendorId} vendor={vendor} />
        ))}
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold tracking-wide">Vendor 1 vs Vendor 2</h2>
          <p className="text-xs text-muted-foreground">
            Perbandingan SLA compliance, kecepatan resolusi, dan kendala operasional bulanan
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metrik</TableHead>
              <TableHead>Vendor 1</TableHead>
              <TableHead>Vendor 2</TableHead>
              <TableHead>Lebih Baik</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.map((row) => (
              <TableRow key={row.metric}>
                <TableCell className="font-medium">{row.metric}</TableCell>
                <TableCell className="font-mono text-xs">{row.vendor1}</TableCell>
                <TableCell className="font-mono text-xs">{row.vendor2}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.winner === "Tie"
                        ? "secondary"
                        : row.winner === "Vendor 1"
                          ? "safe"
                          : "warning"
                    }
                  >
                    {row.winner}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
