"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import {
  LO_SHIFT_LABELS,
  type LoShiftType,
} from "@/config/liaison.config";
import type { NocShiftRow, NocUser, ShiftDutyStatus } from "@/lib/ticketing";

type ShiftTypeOpt = { id: LoShiftType; label: string };

export function LoRosterModule() {
  const { can, user } = useAuth();
  const canManage = can("liaison:handover");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shifts, setShifts] = useState<NocShiftRow[]>([]);
  const [users, setUsers] = useState<NocUser[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOpt[]>([]);
  const [currentLoShift, setCurrentLoShift] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [shiftType, setShiftType] = useState<LoShiftType>("DAY_DOG");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/liaison?date=${encodeURIComponent(date)}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      shifts?: NocShiftRow[];
      users?: NocUser[];
      shiftTypes?: ShiftTypeOpt[];
      currentLoShift?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat roster LO");
      return;
    }
    setShifts(data.shifts ?? []);
    setUsers(data.users ?? []);
    setShiftTypes(data.shiftTypes ?? []);
    setCurrentLoShift(data.currentLoShift ?? "");
    if (!userId && (data.users?.length ?? 0) > 0) {
      setUserId(data.users![0].id);
    }
  }, [date, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/liaison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal");
        return;
      }
      setMessage("Roster LO diperbarui.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!can("liaison:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses roster Liaison LO.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Shift DOG aktif:{" "}
          <Badge variant="secondary">
            {LO_SHIFT_LABELS[currentLoShift as LoShiftType] ?? currentLoShift}
          </Badge>
        </span>
        <label className="ml-auto flex items-center gap-1">
          Tanggal
          <input
            type="date"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {(error || message) && (
        <p className={`text-xs ${error ? "text-destructive" : "text-emerald-600"}`}>
          {error || message}
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
          <label className="flex flex-col gap-1 text-[11px]">
            Personil LO
            <select
              className="h-8 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            Shift
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as LoShiftType)}
            >
              {(shiftTypes.length
                ? shiftTypes
                : [
                    { id: "DAY_DOG" as const, label: "DOG Siang" },
                    { id: "NIGHT_DOG" as const, label: "DOG Malam" },
                  ]
              ).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            disabled={busy || !userId}
            onClick={() =>
              void post({
                action: "upsert_shift",
                userId,
                shiftDate: date,
                shiftType,
                status: "SCHEDULED",
              })
            }
          >
            Tambah / update roster
          </Button>
        </div>
      )}

      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">Roster LO (DOG)</h2>
          <p className="text-[11px] text-muted-foreground">
            2 shift · {date} · login sebagai {user?.name}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Personil</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[200px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                  Belum ada roster LO untuk tanggal ini.
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">
                    {s.userName}
                    <span className="ml-1 text-muted-foreground">({s.role})</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {LO_SHIFT_LABELS[s.shiftType as LoShiftType] ?? s.shiftType}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        s.status === "ON_DUTY"
                          ? "safe"
                          : s.status === "OFF_DUTY"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {canManage && (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busy || s.status === "ON_DUTY"}
                          onClick={() =>
                            void post({
                              action: "set_duty",
                              shiftId: s.id,
                              status: "ON_DUTY" as ShiftDutyStatus,
                            })
                          }
                        >
                          On duty
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={busy || s.status === "OFF_DUTY"}
                          onClick={() =>
                            void post({
                              action: "set_duty",
                              shiftId: s.id,
                              status: "OFF_DUTY" as ShiftDutyStatus,
                            })
                          }
                        >
                          Off
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
