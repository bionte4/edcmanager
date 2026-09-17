"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Shuffle,
  Upload,
  X,
} from "lucide-react";
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
import { NOC_SHIFT_WINDOWS, shiftTypeLabel, type NocShiftType } from "@/config/noc.config";
import {
  ATTENDANCE_STATUS_LABELS,
  SWAP_STATUS_LABELS,
  dateInJakarta,
  monthBounds,
  weekBounds,
  type AttendanceStatus,
  type RosterPeriodMode,
  type SwapRequestStatus,
} from "@/config/wfm.config";
import type { AttendanceLog, ShiftSwapRequest } from "@/data/wfm-store";
import type { NocShiftRow } from "@/lib/ticketing";
import { formatDateTime } from "@/lib/utils";

interface WfmKpis {
  today: string;
  currentShiftType: NocShiftType;
  rosterToday: number;
  onDutyNow: number;
  presentToday: number;
  pendingSwaps: number;
}

const inputClass =
  "h-7 w-full rounded-md border border-input bg-background px-2 text-xs";

function attendanceVariant(
  status: AttendanceStatus
): "safe" | "warning" | "breached" | "secondary" {
  if (status === "PRESENT") return "safe";
  if (status === "LATE") return "warning";
  if (status === "OUT_OF_WINDOW") return "breached";
  return "secondary";
}

function swapVariant(
  status: SwapRequestStatus
): "safe" | "warning" | "breached" | "secondary" {
  if (status === "APPROVED") return "safe";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED") return "breached";
  return "secondary";
}

export function WfmModule() {
  const { can, user } = useAuth();
  const canApprove = can("wfm:approve");
  const canManageRoster = can("noc:manage_shift") || can("wfm:approve");
  const fileRef = useRef<HTMLInputElement>(null);

  const [kpis, setKpis] = useState<WfmKpis | null>(null);
  const [shifts, setShifts] = useState<NocShiftRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [periodMode, setPeriodMode] = useState<RosterPeriodMode>("week");
  const [anchor, setAnchor] = useState(dateInJakarta());
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");

  const [myShiftId, setMyShiftId] = useState("");
  const [targetShiftId, setTargetShiftId] = useState("");
  const [reason, setReason] = useState("");

  const period = useMemo(() => {
    try {
      if (periodMode === "month") return monthBounds(anchor);
      return weekBounds(anchor);
    } catch {
      return weekBounds(dateInJakarta());
    }
  }, [periodMode, anchor]);

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams({
      from: period.from,
      to: period.to,
    });
    const res = await fetch(`/api/wfm?${qs}`, { cache: "no-store" });
    const data = (await res.json()) as {
      error?: string;
      kpis?: WfmKpis;
      shifts?: NocShiftRow[];
      attendance?: AttendanceLog[];
      swaps?: ShiftSwapRequest[];
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat WFM");
      return;
    }
    setKpis(data.kpis ?? null);
    setShifts(data.shifts ?? []);
    setAttendance(data.attendance ?? []);
    setSwaps(data.swaps ?? []);
  }, [period.from, period.to]);

  useEffect(() => {
    void load();
    try {
      const raw = sessionStorage.getItem("edc_login_attendance");
      if (raw) {
        const att = JSON.parse(raw) as { status: string; note?: string | null };
        setMessage(
          `Kehadiran login: ${att.status}${att.note ? ` — ${att.note}` : ""}`
        );
        sessionStorage.removeItem("edc_login_attendance");
      }
    } catch {
      // ignore
    }
  }, [load]);

  const myShifts = useMemo(
    () => shifts.filter((s) => s.userId === user?.id),
    [shifts, user?.id]
  );
  const otherShifts = useMemo(
    () => shifts.filter((s) => s.userId !== user?.id),
    [shifts, user?.id]
  );
  const pendingSwaps = useMemo(
    () => swaps.filter((s) => s.status === "PENDING"),
    [swaps]
  );

  useEffect(() => {
    if (!myShiftId && myShifts[0]) setMyShiftId(myShifts[0].id);
  }, [myShifts, myShiftId]);

  useEffect(() => {
    if (!targetShiftId && otherShifts[0]) setTargetShiftId(otherShifts[0].id);
  }, [otherShifts, targetShiftId]);

  async function downloadRoster(action: "export" | "template") {
    setError(null);
    const qs = new URLSearchParams({
      action,
      mode: periodMode === "month" ? "month" : "week",
      anchor,
    });
    const res = await fetch(`/api/wfm/roster/excel?${qs}`, { cache: "no-store" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Download gagal");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      action === "template"
        ? `edc-roster-template-${period.from}_${period.to}.xlsx`
        : `edc-roster-${period.from}_${period.to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onUpload(file: File) {
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    form.append("importMode", importMode);
    const res = await fetch("/api/wfm/roster/excel", {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as {
      error?: string;
      result?: {
        created: number;
        updated: number;
        cleared: number;
        errors: string[];
        from: string;
        to: string;
      };
    };
    if (!res.ok) {
      setError(data.error || "Import gagal");
      return;
    }
    const r = data.result;
    setMessage(
      r
        ? `Import OK · +${r.created} baru · ${r.updated} update · clear ${r.cleared}` +
            (r.errors.length ? ` · ${r.errors.length} baris error` : "")
        : "Import selesai."
    );
    await load();
  }

  async function submitSwap() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/wfm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "swap_request",
        requesterShiftId: myShiftId,
        targetShiftId,
        reason,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal ajukan tukar shift");
      return;
    }
    setMessage("Permintaan tukar shift dikirim — menunggu approval.");
    setReason("");
    await load();
  }

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/wfm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "swap_decide", id, decision }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal memutuskan");
      return;
    }
    setMessage(decision === "APPROVED" ? "Tukar shift disetujui." : "Tukar shift ditolak.");
    await load();
  }

  async function cancel(id: string) {
    const res = await fetch("/api/wfm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "swap_cancel", id }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal batalkan");
      return;
    }
    setMessage("Permintaan dibatalkan.");
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi title="Tanggal (WIB)" value={kpis?.today ?? "…"} />
        <Kpi
          title="Shift aktif"
          value={kpis ? NOC_SHIFT_WINDOWS[kpis.currentShiftType].label : "…"}
        />
        <Kpi title="Roster hari ini" value={String(kpis?.rosterToday ?? 0)} />
        <Kpi
          title="On duty / hadir"
          value={`${kpis?.onDutyNow ?? 0}/${kpis?.presentToday ?? 0}`}
        />
        <Kpi title="Swap pending" value={String(kpis?.pendingSwaps ?? 0)} tone="warn" />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Login NOC/L1 (dan Supervisor yang ber-roster) otomatis dicatat hadir sesuai shift window
        roster. Tukar shift membutuhkan approval Supervisor / Ops / Admin. Roster weekly/monthly
        bisa di-upload dari Excel.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="xs" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {(error || message) && (
        <p className={`text-xs ${error ? "text-sla-breached" : "text-sla-safe"}`}>
          {error || message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Roster weekly / monthly · Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Periode">
            <select
              className={inputClass}
              value={periodMode}
              onChange={(e) =>
                setPeriodMode(e.target.value === "month" ? "month" : "week")
              }
            >
              <option value="week">Mingguan (Sen–Min)</option>
              <option value="month">Bulanan</option>
            </select>
          </Field>
          <Field label="Anchor tanggal">
            <input
              type="date"
              className={inputClass}
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
            />
          </Field>
          <Field label="Rentang aktif">
            <p className="font-mono text-[11px] leading-7">
              {period.from} → {period.to}
            </p>
          </Field>
          {canManageRoster && (
            <Field label="Mode import">
              <select
                className={inputClass}
                value={importMode}
                onChange={(e) =>
                  setImportMode(e.target.value === "replace" ? "replace" : "merge")
                }
              >
                <option value="merge">Merge (upsert)</option>
                <option value="replace">Replace rentang file</option>
              </select>
            </Field>
          )}
          <div className="flex flex-wrap gap-1.5 sm:col-span-2 lg:col-span-4">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void downloadRoster("template")}
            >
              <Download className="h-3 w-3" />
              Template
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void downloadRoster("export")}
            >
              <Download className="h-3 w-3" />
              Export periode
            </Button>
            {canManageRoster && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" size="xs" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3 w-3" />
                  Upload Excel
                </Button>
              </>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground sm:col-span-2 lg:col-span-4">
            Kolom:{" "}
            <span className="font-mono">shiftDate | email | shiftType | status | notes</span> ·
            shiftType = MORNING / AFTERNOON / NIGHT · email harus user NOC/SUPERVISOR aktif.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-foreground">
              <Shuffle className="h-3.5 w-3.5" />
              Ajukan tukar shift
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {myShifts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Anda tidak punya baris roster (hanya NOC/L1 & Supervisor ber-roster yang bisa tukar).
              </p>
            ) : (
              <>
                <Field label="Shift saya">
                  <select
                    className={inputClass}
                    value={myShiftId}
                    onChange={(e) => setMyShiftId(e.target.value)}
                  >
                    {myShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shiftDate} · {s.shiftType} · {s.status}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tukar dengan">
                  <select
                    className={inputClass}
                    value={targetShiftId}
                    onChange={(e) => setTargetShiftId(e.target.value)}
                  >
                    {otherShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.userName} · {s.shiftDate} · {s.shiftType}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Alasan">
                  <input
                    className={inputClass}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Mis. keperluan keluarga / overlap tiket VIP"
                  />
                </Field>
                <Button type="button" size="xs" onClick={() => void submitSwap()}>
                  Kirim permintaan
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Antrian approval tukar shift
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSwaps.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Tidak ada permintaan pending.</p>
            ) : (
              pendingSwaps.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md border border-border px-2.5 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="warning">PENDING</Badge>
                    <span className="font-medium">{s.requesterName}</span>
                    <span className="text-muted-foreground">↔ {s.targetUserName}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.reason}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateTime(s.createdAt)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {canApprove && (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          onClick={() => void decide(s.id, "APPROVED")}
                        >
                          <Check className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => void decide(s.id, "REJECTED")}
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </Button>
                      </>
                    )}
                    {s.requesterId === user?.id && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => void cancel(s.id)}
                      >
                        Batalkan
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">
            Roster · {periodMode === "month" ? "Bulanan" : "Mingguan"} ({period.from} →{" "}
            {period.to})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Duty</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada roster di periode ini. Upload Excel atau unduh template.
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-[11px]">{s.shiftDate}</TableCell>
                  <TableCell className="text-xs">
                    {shiftTypeLabel(s.shiftType)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{s.userName}</TableCell>
                  <TableCell className="text-[11px]">
                    {s.role === "NOC" ? "NOC / L1" : s.role}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        s.status === "ON_DUTY"
                          ? "safe"
                          : s.status === "SCHEDULED"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {s.notes || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-xs font-semibold tracking-wide">Log kehadiran (login)</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                    Belum ada punch login.
                  </TableCell>
                </TableRow>
              ) : (
                attendance.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {formatDateTime(a.loggedAt)}
                    </TableCell>
                    <TableCell className="text-xs">{a.userName}</TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {a.shiftType ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={attendanceVariant(a.status)}>
                        {ATTENDANCE_STATUS_LABELS[a.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-xs font-semibold tracking-wide">Riwayat tukar shift</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pemohon</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Diputus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {swaps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                    Belum ada permintaan.
                  </TableCell>
                </TableRow>
              ) : (
                swaps.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.requesterName}</TableCell>
                    <TableCell className="text-xs">{s.targetUserName}</TableCell>
                    <TableCell>
                      <Badge variant={swapVariant(s.status)}>
                        {SWAP_STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {s.decidedByName
                        ? `${s.decidedByName}${s.decidedAt ? ` · ${formatDateTime(s.decidedAt)}` : ""}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
