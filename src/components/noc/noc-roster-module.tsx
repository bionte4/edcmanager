"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Headset, UserCheck } from "lucide-react";
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
import { NOC_SHIFT_WINDOWS, type NocShiftType } from "@/config/noc.config";
import { ROLE_LABELS, SHIFT_STATUS_LABELS } from "@/data/noc";
import type { NocShiftRow, ShiftDutyStatus } from "@/lib/ticketing";
import { cn } from "@/lib/utils";

function dutyBadge(status: ShiftDutyStatus): "safe" | "warning" | "secondary" {
  if (status === "ON_DUTY") return "safe";
  if (status === "SCHEDULED") return "warning";
  return "secondary";
}

export function NocRosterModule() {
  const { can } = useAuth();
  const canManage = can("noc:manage_shift");
  const [shifts, setShifts] = useState<NocShiftRow[]>([]);
  const [filter, setFilter] = useState<NocShiftType | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/wfm", { cache: "no-store" });
    const data = (await res.json()) as { shifts?: NocShiftRow[]; error?: string };
    if (!res.ok) {
      // Fallback: user may have noc:read but not wfm:read
      if (res.status === 403) {
        setError("Roster terhubung ke WFM — minta akses wfm:read atau buka menu WFM.");
      } else {
        setError(data.error || "Gagal memuat roster");
      }
      return;
    }
    setShifts(data.shifts ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDuty = useMemo(
    () => shifts.filter((s) => s.status === "ON_DUTY"),
    [shifts]
  );

  const filtered = useMemo(
    () => (filter === "ALL" ? shifts : shifts.filter((s) => s.shiftType === filter)),
    [shifts, filter]
  );

  async function setDuty(shift: NocShiftRow, status: ShiftDutyStatus) {
    if (!canManage) return;
    const res = await fetch("/api/wfm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_duty", shiftId: shift.id, status }),
    });
    const data = (await res.json()) as { error?: string; shift?: NocShiftRow };
    if (!res.ok) {
      setError(data.error || "Gagal update duty");
      return;
    }
    setShifts((prev) =>
      prev.map((s) => (s.id === shift.id ? { ...s, status } : s))
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>On Duty Sekarang</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-semibold tabular-nums">{onDuty.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Dari roster WFM (login auto-hadir)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Baris Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-semibold tabular-nums">{shifts.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Termasuk roster hari ini</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Shift Windows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {Object.entries(NOC_SHIFT_WINDOWS).map(([key, value]) => (
              <p key={key}>
                <span className="font-medium text-foreground">{value.label}</span>
                {" · "}
                {String(Math.floor(value.startMinutes / 60)).padStart(2, "0")}:
                {String(value.startMinutes % 60).padStart(2, "0")}–
                {String(Math.floor(value.endMinutes / 60)).padStart(2, "0")}:
                {String(value.endMinutes % 60).padStart(2, "0")} WIB
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-xs text-sla-breached">{error}</p>}

      <section className="rounded-md border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide">
              <Headset className="h-4 w-4" />
              Roster Standby NOC / L1
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Sumber data sama dengan modul WFM · tukar shift via /wfm
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="xs"
              variant={filter === "ALL" ? "default" : "outline"}
              onClick={() => setFilter("ALL")}
            >
              Semua
            </Button>
            {(Object.keys(NOC_SHIFT_WINDOWS) as NocShiftType[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="xs"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key)}
              >
                {NOC_SHIFT_WINDOWS[key].label}
              </Button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell className="text-xs font-medium">{shift.userName}</TableCell>
                <TableCell className="text-[11px]">
                  {ROLE_LABELS[shift.role] ?? shift.role}
                </TableCell>
                <TableCell className="font-mono text-[11px]">{shift.shiftDate}</TableCell>
                <TableCell className="text-xs">
                  {NOC_SHIFT_WINDOWS[shift.shiftType].label}
                </TableCell>
                <TableCell>
                  <Badge variant={dutyBadge(shift.status)}>
                    {SHIFT_STATUS_LABELS[shift.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {shift.notes || "—"}
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="inline-flex gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant={shift.status === "ON_DUTY" ? "default" : "outline"}
                        className={cn(shift.status === "ON_DUTY" && "pointer-events-none")}
                        onClick={() => void setDuty(shift, "ON_DUTY")}
                      >
                        <UserCheck className="h-3 w-3" />
                        On
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => void setDuty(shift, "OFF_DUTY")}
                      >
                        Off
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
