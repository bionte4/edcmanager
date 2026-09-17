"use client";

import {
  Activity,
  AlertTriangle,
  Building2,
  Package,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
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
import type { ExecutiveSummary } from "@/data/executive-dashboard";
import { formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

function riskVariant(
  risk: ExecutiveSummary["national"]["penaltyRisk"]
): "safe" | "warning" | "breached" {
  if (risk === "LOW") return "safe";
  if (risk === "MEDIUM") return "warning";
  return "breached";
}

function ExecKpi({
  title,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
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
        <p className="font-mono text-xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function ExecutiveDashboard({ summary }: { summary: ExecutiveSummary }) {
  const { national, buffer, deployment, vendors, trend, narrative } = summary;
  const maxSla = Math.max(...trend.map((t) => t.slaCompliance), 1);

  const slaTone =
    national.slaCompliancePercent >= national.slaFloor
      ? "ok"
      : national.slaCompliancePercent >= national.slaFloor - 3
        ? "warn"
        : "danger";
  const uptimeTone =
    national.uptimePercent >= national.uptimeTarget
      ? "ok"
      : national.uptimePercent >= national.uptimeTarget - 0.05
        ? "warn"
        : "danger";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Ringkasan nasional untuk GM / BOD — bukan operasional tiket detail.
        </p>
        <Badge variant={riskVariant(national.penaltyRisk)} className="ml-auto">
          Penalty risk: {national.penaltyRisk}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <ExecKpi
          title="SLA Compliance"
          value={formatPercent(national.slaCompliancePercent, 1)}
          hint={`Lantai ${national.slaFloor}% · tertimbang tiket`}
          icon={TrendingUp}
          tone={slaTone}
        />
        <ExecKpi
          title="Uptime Nasional"
          value={formatPercent(national.uptimePercent)}
          hint={`Target ${formatPercent(national.uptimeTarget, 1)}`}
          icon={Activity}
          tone={uptimeTone}
        />
        <ExecKpi
          title="Penalty Exposure"
          value={String(national.breachedTickets)}
          hint={`${national.openTickets} tiket open · breach periode`}
          icon={ShieldAlert}
          tone={
            national.penaltyRisk === "HIGH"
              ? "danger"
              : national.penaltyRisk === "MEDIUM"
                ? "warn"
                : "ok"
          }
        />
        <ExecKpi
          title="Buffer Health"
          value={`${buffer.roTotal - buffer.roBelow}/${buffer.roTotal}`}
          hint={`RO ≥ ${buffer.minPercent}% · ${buffer.roBelow} di bawah`}
          icon={Package}
          tone={buffer.roBelow === 0 ? "ok" : "danger"}
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Target className="h-3.5 w-3.5" />
              Deployment vs kuota 3 tahun
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>
                  {deployment.deployedUnits.toLocaleString("id-ID")} /{" "}
                  {deployment.targetUnits.toLocaleString("id-ID")} unit
                </span>
                <span className="font-mono">
                  {formatPercent(deployment.progressPercent, 1)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/80"
                  style={{
                    width: `${Math.min(100, deployment.progressPercent)}%`,
                  }}
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Deployed</TableHead>
                  <TableHead>Kuota</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployment.byVendor.map((v) => (
                  <TableRow key={v.vendorName}>
                    <TableCell className="text-xs font-medium">
                      {v.vendorName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.deployed.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.quota.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatPercent(v.progressPercent, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              Tren SLA 6 bulan
            </CardTitle>
            <p className="pt-1 text-[10px] font-normal text-muted-foreground">
              Dari MetricLog nasional (agregat vendor)
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-2">
              {trend.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada MetricLog.</p>
              ) : (
                trend.map((t) => (
                <div
                  key={t.monthLabel}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {t.slaCompliance.toFixed(0)}%
                  </span>
                  <div
                    className="w-full max-w-[40px] rounded-t bg-foreground/75"
                    style={{
                      height: `${Math.max((t.slaCompliance / maxSla) * 100, t.slaCompliance > 0 ? 8 : 2)}%`,
                      minHeight: t.slaCompliance > 0 ? 8 : 2,
                    }}
                    title={`Uptime ${t.uptimePercent.toFixed(2)}% · breach ${t.breachedTickets}`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {t.monthLabel.split(" ")[0]}
                  </span>
                </div>
              ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-xs">Vendor scorecard</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Breach</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((v) => (
                  <TableRow key={v.vendorId}>
                    <TableCell className="text-xs font-medium">
                      {v.vendorName}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {v.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatPercent(v.slaComplianceRate, 1)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatPercent(v.uptimePercent)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.breachedTickets}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              Briefing eksekutif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {narrative.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/50" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
