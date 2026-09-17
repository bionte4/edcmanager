"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileBarChart2, RefreshCw } from "lucide-react";
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
import { DEMO_AS_OF } from "@/data/dashboard";
import type { OpsReportSummary, OpsReportTicketRow } from "@/data/reporting";

type Preset = "today" | "week" | "month" | "custom";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-xs";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfWeekMon(d: Date): Date {
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(d, offset);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function resolvePreset(preset: Preset, anchor: Date, customFrom: string, customTo: string) {
  const today = ymd(anchor);
  if (preset === "today") {
    return { from: today, to: today, label: `Hari ini (${today})` };
  }
  if (preset === "week") {
    const from = ymd(startOfWeekMon(anchor));
    const to = ymd(addDays(startOfWeekMon(anchor), 6));
    return { from, to, label: `Minggu ${from} → ${to}` };
  }
  if (preset === "month") {
    const from = ymd(startOfMonth(anchor));
    const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    const to = ymd(last);
    return { from, to, label: `Bulan ${from.slice(0, 7)}` };
  }
  return {
    from: customFrom || today,
    to: customTo || today,
    label: `Custom ${customFrom || today} → ${customTo || today}`,
  };
}

export function ReportingModule() {
  const { can } = useAuth();
  const anchor = DEMO_AS_OF;
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(ymd(startOfMonth(anchor)));
  const [customTo, setCustomTo] = useState(ymd(anchor));
  const [previewed, setPreviewed] = useState(false);

  const [summary, setSummary] = useState<OpsReportSummary | null>(null);
  const [tickets, setTickets] = useState<OpsReportTicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const period = useMemo(
    () => resolvePreset(preset, anchor, customFrom, customTo),
    [preset, anchor, customFrom, customTo]
  );

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams({
      from: period.from,
      to: period.to,
      label: period.label,
    });
    const res = await fetch(`/api/reporting?${qs}`, { cache: "no-store" });
    const data = (await res.json()) as {
      error?: string;
      summary?: OpsReportSummary;
      tickets?: OpsReportTicketRow[];
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat laporan");
      setPreviewed(false);
      return;
    }
    setSummary(data.summary ?? null);
    setTickets(data.tickets ?? []);
    setPreviewed(true);
  }, [period.from, period.to, period.label]);

  useEffect(() => {
    setPreviewed(false);
  }, [period.from, period.to, period.label]);

  async function exportExcel() {
    if (!can("report:export")) return;
    if (!previewed) {
      setError("Preview dulu periode laporan sebelum export.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from: period.from,
        to: period.to,
        label: period.label,
      });
      const res = await fetch(`/api/reporting/excel?${qs}`, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Export gagal");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edc-ops-report-${period.from}_${period.to}.xlsx`;
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
      <Card>
        <CardHeader>
          <CardTitle>Periode laporan</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Pilih rentang tanggal → Preview → Export Excel (tiket, vendor, buffer,{" "}
            <strong>performance personil</strong>).
          </p>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="text-muted-foreground">Preset</span>
            <select
              className={inputClass}
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
            >
              <option value="today">Hari ini</option>
              <option value="week">Minggu ini (Sen–Min)</option>
              <option value="month">Bulan ini</option>
              <option value="custom">Custom date</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="text-muted-foreground">Start</span>
            <input
              type="date"
              className={inputClass}
              value={preset === "custom" ? customFrom : period.from}
              disabled={preset !== "custom"}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="text-muted-foreground">End</span>
            <input
              type="date"
              className={inputClass}
              value={preset === "custom" ? customTo : period.to}
              disabled={preset !== "custom"}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          <div className="flex flex-col justify-end gap-1.5">
            <p className="font-mono text-[11px] text-muted-foreground">{period.label}</p>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                <Eye className="h-3 w-3" />
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void load()}
                title="Refresh preview"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              {can("report:export") && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void exportExcel()}
                  disabled={busy || !previewed}
                >
                  <Download className="h-3 w-3" />
                  Export Excel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!previewed ? (
        <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
          Belum ada preview. Pilih periode lalu klik <strong>Preview</strong>.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Preview · {summary?.period.label ?? period.label} · tiket di periode:{" "}
            {summary?.tickets.total ?? 0}
          </p>

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
              title="Avg score personil"
              value={
                summary
                  ? summary.personnel.avgScore.toFixed(0)
                  : "…"
              }
            />
            <Kpi
              title="Personil di bawah floor"
              value={
                summary
                  ? String(
                      summary.personnel.belowSlaFloor +
                        summary.personnel.belowAttendanceFloor
                    )
                  : "…"
              }
              tone="warn"
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
              <h2 className="text-xs font-semibold tracking-wide">
                Performance personil
              </h2>
              <p className="text-[11px] text-muted-foreground">
                NOC / Supervisor / teknisi — skor dari SLA tiket, kehadiran WFM, dan
                throughput. Floor SLA {summary?.personnel.slaFloor ?? 90}% · absensi{" "}
                {summary?.personnel.attendanceFloor ?? 85}%. Sheet Excel:{" "}
                <span className="font-mono">Personnel</span>.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Hadir / Late / Absen</TableHead>
                  <TableHead>Absensi %</TableHead>
                  <TableHead>Owned</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>SLA %</TableHead>
                  <TableHead>Breach</TableHead>
                  <TableHead>Aktivitas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.personnel.rows ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-4 text-center text-xs text-muted-foreground"
                    >
                      Tidak ada data personil di periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  (summary?.personnel.rows ?? []).map((p) => {
                    const slaLow =
                      p.ticketsOwned + p.ticketsCreated > 0 &&
                      p.slaCompliancePercent < (summary?.personnel.slaFloor ?? 90);
                    const attLow =
                      p.shiftsScheduled > 0 &&
                      p.attendanceRate <
                        (summary?.personnel.attendanceFloor ?? 85);
                    return (
                      <TableRow key={p.personKey}>
                        <TableCell className="text-xs font-medium">
                          {p.name}
                          {p.kind === "TECHNICIAN" && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              field
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.role}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {p.performanceScore}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">
                          {p.present}/{p.late}/{p.absent}
                          {p.shiftsScheduled > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {p.shiftsScheduled} shift
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={`font-mono text-xs ${
                            attLow ? "text-sla-breached" : ""
                          }`}
                        >
                          {p.shiftsScheduled > 0
                            ? `${p.attendanceRate.toFixed(0)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.ticketsOwned}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.ticketsCreated}
                        </TableCell>
                        <TableCell
                          className={`font-mono text-xs ${
                            slaLow ? "text-sla-breached" : ""
                          }`}
                        >
                          {p.ticketsOwned + p.ticketsCreated > 0
                            ? `${p.slaCompliancePercent.toFixed(0)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.ticketsBreached}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.activitiesCount}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

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
                Tickets · SLA &amp; OLA (periode)
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
                      Tidak ada tiket di rentang tanggal ini.
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
        </>
      )}
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
