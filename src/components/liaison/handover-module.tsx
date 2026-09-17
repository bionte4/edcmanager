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
import type { HandoverRow } from "@/data/liaison-store";
import type { NocUser } from "@/lib/ticketing";
import { formatDateTime } from "@/lib/utils";

export function HandoverModule() {
  const { can } = useAuth();
  const canManage = can("liaison:handover");
  const [rows, setRows] = useState<HandoverRow[]>([]);
  const [users, setUsers] = useState<NocUser[]>([]);
  const [currentLoShift, setCurrentLoShift] = useState<LoShiftType>("DAY_DOG");
  const [summary, setSummary] = useState("");
  const [openTickets, setOpenTickets] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/liaison", { cache: "no-store" });
    const data = (await res.json()) as {
      handovers?: HandoverRow[];
      users?: NocUser[];
      currentLoShift?: LoShiftType;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat handover");
      return;
    }
    setRows(data.handovers ?? []);
    setUsers(data.users ?? []);
    if (data.currentLoShift) setCurrentLoShift(data.currentLoShift);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/liaison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "handover_create",
          fromShiftType: currentLoShift,
          toUserId: toUserId || undefined,
          summary,
          openTickets: openTickets
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal buat handover");
        return;
      }
      setMessage("Handover tersimpan.");
      setSummary("");
      setOpenTickets("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function ack(id: string) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/liaison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "handover_ack", handoverId: id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal acknowledge");
        return;
      }
      setMessage("Handover di-acknowledge.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!can("liaison:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses handover LO.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(error || message) && (
        <p className={`text-xs ${error ? "text-destructive" : "text-emerald-600"}`}>
          {error || message}
        </p>
      )}

      {canManage && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">
            Buat handover dari{" "}
            <strong>{LO_SHIFT_LABELS[currentLoShift]}</strong> ke shift
            berikutnya.
          </p>
          <textarea
            className="min-h-[72px] rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="Ringkasan: tiket kritis, pending BRI, issue vendor…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <input
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            placeholder="No. tiket (pisahkan spasi/koma), opsional"
            value={openTickets}
            onChange={(e) => setOpenTickets(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[11px]">
              Penerima (opsional)
              <select
                className="h-8 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
              >
                <option value="">— belakangan —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy || !summary.trim()}
              onClick={() => void create()}
            >
              Simpan handover
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">Log handover DOG</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Dari → Ke</TableHead>
              <TableHead>Ringkasan</TableHead>
              <TableHead>Tiket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Belum ada handover.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-[11px]">
                    {formatDateTime(h.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {h.fromUserName} ({LO_SHIFT_LABELS[h.fromShiftType]}) →{" "}
                    {h.toUserName ?? "—"} ({LO_SHIFT_LABELS[h.toShiftType]})
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs">{h.summary}</TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {h.openTickets.length ? h.openTickets.join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={h.acknowledgedAt ? "safe" : "warning"}>
                      {h.acknowledgedAt ? "ACK" : "Pending ACK"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canManage && !h.acknowledgedAt && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void ack(h.id)}
                      >
                        ACK
                      </Button>
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
