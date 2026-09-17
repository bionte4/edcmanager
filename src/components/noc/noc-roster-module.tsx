"use client";

import { useMemo, useState } from "react";
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
import { NOC_SHIFT_WINDOWS, type NocShiftType } from "@/config/noc.config";
import {
  MOCK_NOC_SHIFTS,
  MOCK_USERS,
  ROLE_LABELS,
  SHIFT_STATUS_LABELS,
} from "@/data/noc";
import type { NocShiftRow, ShiftDutyStatus } from "@/lib/ticketing";
import { cn } from "@/lib/utils";

function dutyBadge(status: ShiftDutyStatus): "safe" | "warning" | "secondary" {
  if (status === "ON_DUTY") return "safe";
  if (status === "SCHEDULED") return "warning";
  return "secondary";
}

export function NocRosterModule() {
  const [shifts, setShifts] = useState(MOCK_NOC_SHIFTS);
  const [filter, setFilter] = useState<NocShiftType | "ALL">("ALL");

  const onDuty = useMemo(
    () => shifts.filter((s) => s.status === "ON_DUTY"),
    [shifts]
  );

  const filtered = useMemo(
    () => (filter === "ALL" ? shifts : shifts.filter((s) => s.shiftType === filter)),
    [shifts, filter]
  );

  function setDuty(shift: NocShiftRow, status: ShiftDutyStatus) {
    setShifts((prev) =>
      prev.map((s) => (s.id === shift.id ? { ...s, status } : s))
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>On Duty Sekarang</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">{onDuty.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">NOC + Supervisor standby</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Personil Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {MOCK_USERS.filter((u) => u.isActive).length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Terdaftar di sistem</p>
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

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide">
              <Headset className="h-4 w-4" />
              Roster Standby NOC
            </h2>
            <p className="text-xs text-muted-foreground">
              Tandai On Duty / Off Duty untuk handover shift
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["ALL", "MORNING", "AFTERNOON", "NIGHT"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
              >
                {value === "ALL" ? "Semua" : NOC_SHIFT_WINDOWS[value].label}
              </Button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell className="font-medium">{shift.userName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[shift.role]}</Badge>
                </TableCell>
                <TableCell>{NOC_SHIFT_WINDOWS[shift.shiftType].label}</TableCell>
                <TableCell className="font-mono text-xs">{shift.shiftDate}</TableCell>
                <TableCell>
                  <Badge variant={dutyBadge(shift.status)}>
                    {SHIFT_STATUS_LABELS[shift.status]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {shift.notes || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(shift.status === "ON_DUTY" && "border-sla-safe text-sla-safe")}
                      onClick={() => setDuty(shift, "ON_DUTY")}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      On Duty
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDuty(shift, "OFF_DUTY")}
                    >
                      Off
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold tracking-wide">Directory Personil</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_USERS.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{user.email}</TableCell>
                <TableCell className="font-mono text-xs">{user.phone || "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "safe" : "secondary"}>
                    {user.isActive ? "Aktif" : "Nonaktif"}
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
