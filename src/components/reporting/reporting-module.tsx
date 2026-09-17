"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileBarChart2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import type { OpsReportSummary, OpsReportTicketRow } from "@/data/reporting";

export function ReportingModule() {
  const { can } = useAuth();
  const [summary, setSummary] = useState<OpsReportSummary | null>(null);
  const [tickets, setTickets] = useState<OpsReportTicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/reporting", { cache: "no-store" });
    const data = (await res.json()) as {
      error?: string;
      summary?: OpsReportSummary;
      tickets?: OpsReportTicketRow[];
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat laporan");
      return;
    }
    setSummary(data.summary ?? null);
    setTickets(data.tickets ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportExcel() {
    if (!can("report:export")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reporting/excel", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Export gagal");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edc-ops-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export gagal");
    } finally {
      setBusy(false);
    }
  }

  if (!can("report:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses membaca laporan operasional.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
        {can("report:export") && (
          <Button
            type="button"
            size="sm"
            onClick={() => void exportExcel()}
            disabled={busy}
          >
            <Download className="h-3 w-3" />
            Export Excel
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi title="Tiket total" value={String(summary?.tickets.total ?? "…")} />
        <Kpi title="Tiket aktif" value={String(summary?.tickets.open ?? "…")} />
        <Kpi
          title="Eskalasi SLA"
          value={String(summary?.tickets.slaEscalations ?? "…")}
          tone="warn"
        />
        <Kpi
          title="Eskalasi OLA"
          value={String(summary?.tickets.olaEscalations ?? "…")}
          tone="warn"
        />
        <Kpi
          title="Buffer RO OK"
          value={
            summary
              ? `${summary.buffer.roOk}/${summary.buffer.roTotal}`
              : "…"
          }
        />
        <Kpi
          title="Roster rows"
          value={String(summary?.wfm.rosterPeriodCount ?? "…")}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <FileBarChart2 className="h-3.5 w-3.5" />
              Distribusi SLA / OLA
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs sm:grid-cols-3">
            <StatusMap title="SLA" map={summary?.tickets.sla} />
            <StatusMap title="OLA Ack" map={summary?.tickets.olaAck} />
            <StatusMap title="OLA Dispatch" map={summary?.tickets.olaDispatch} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>SLA %</TableHead>
                  <TableHead>Breach</TableHead>
                  <TableHead>Uptime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.vendors ?? []).map((v) => (
                  <TableRow key={v.vendorId}>
                    <TableCell className="text-xs font-medium">{v.vendorName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.slaComplianceRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.breachedTickets}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.uptimePercent.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">Buffer stock per RO</h2>
          <p className="text-[11px] text-muted-foreground">
            Ambang aman ≥{summary?.buffer.minPercent ?? 10}%
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RO</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Buffer</TableHead>
              <TableHead>%</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(summary?.buffer.rows ?? []).map((r) => (
              <TableRow key={r.regionalOffice}>
                <TableCell className="text-xs">{r.regionalOffice}</TableCell>
                <TableCell className="font-mono text-xs">{r.totalUnits}</TableCell>
                <TableCell className="font-mono text-xs">{r.bufferUnits}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.bufferPercent.toFixed(1)}%
                </TableCell>
                <TableCell>
                  <Badge variant={r.belowThreshold ? "breached" : "safe"}>
                    {r.belowThreshold ? "Below" : "OK"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">
            Tickets · SLA &amp; OLA snapshot
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tiket</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>OLA Ack</TableHead>
              <TableHead>OLA Disp</TableHead>
              <TableHead>Vendor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  Tidak ada data tiket.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => (
                <TableRow key={t.ticketNumber}>
                  <TableCell className="font-mono text-[11px]">
                    {t.ticketNumber}
                  </TableCell>
                  <TableCell className="text-xs">{t.itsmType}</TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {t.merchantId}
                  </TableCell>
                  <TableCell className="text-xs">{t.status}</TableCell>
                  <TableCell className="text-xs">{t.slaStatus}</TableCell>
                  <TableCell className="text-xs">{t.olaAck}</TableCell>
                  <TableCell className="text-xs">{t.olaDispatch}</TableCell>
                  <TableCell className="text-xs">{t.vendorName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatusMap({
  title,
  map,
}: {
  title: string;
  map?: Record<string, number>;
}) {
  const entries = Object.entries(map ?? {});
  return (
    <div>
      <p className="mb-1 font-medium text-muted-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-0.5">
          {entries.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2 font-mono">
              <span>{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`font-mono text-xl font-semibold tabular-nums ${
            tone === "warn" ? "text-sla-warning" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
