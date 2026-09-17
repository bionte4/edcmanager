"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Mail, RefreshCw } from "lucide-react";
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
  isSensitivePauseReason,
  SLA_PAUSE_REASON_CODES,
  SLA_PAUSE_REASON_LABELS,
  type SlaPauseReasonCode,
} from "@/config/sla-pause.config";
import { LOCATION_LABELS, SLA_LABELS } from "@/data/dashboard";
import { formatDateTime } from "@/lib/utils";

type NearBreachRow = {
  id: string;
  ticketNumber: string;
  merchantId: string;
  location: string;
  category: string;
  vendorName: string;
  technicianName?: string;
  slaStatus: "WARNING" | "BREACHED" | string;
  elapsedLabel: string;
  remainingLabel: string;
  elapsedRatio: number;
  deadlineAt: string;
  openedAt: string;
};

export function NearBreachModule() {
  const { can } = useAuth();
  const canPause = can("ticket:sla_pause");
  const canApprove = can("ticket:sla_pause_approve");
  const [rows, setRows] = useState<NearBreachRow[]>([]);
  const [auditWindowActive, setAuditWindowActive] = useState(false);
  const [auditLabel, setAuditLabel] = useState("Audit 16:00 WIB");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const [pauseReason, setPauseReason] =
    useState<SlaPauseReasonCode>("MERCHANT_ACCESS");
  const [pauseNote, setPauseNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/ops/near-breach", { cache: "no-store" });
    const data = (await res.json()) as {
      tickets?: NearBreachRow[];
      auditWindowActive?: boolean;
      auditLabel?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat antrian near-breach");
      return;
    }
    setRows(data.tickets ?? []);
    setAuditWindowActive(!!data.auditWindowActive);
    if (data.auditLabel) setAuditLabel(data.auditLabel);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function onPause(ticketId: string) {
    if (!canPause) return;
    setBusyId(ticketId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/sla-clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pause",
          reasonCode: pauseReason,
          reasonNote: pauseNote || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; ticket?: { slaPauses?: Array<{ approvalStatus: string }> } };
      if (!res.ok) {
        setError(data.error || "Gagal clock-stop");
        return;
      }
      const pending = data.ticket?.slaPauses?.some(
        (p) => p.approvalStatus === "PENDING"
      );
      setMessage(
        pending
          ? "Permintaan clock-stop dikirim — menunggu approval Supervisor."
          : "Clock-stop diterapkan — tiket keluar dari antrian near-breach."
      );
      setPauseNote("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function sendDigest(force = false) {
    setDigestBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/ops/near-breach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "digest", force }),
      });
      const data = (await res.json()) as {
        skipped?: boolean;
        reason?: string;
        dayKey?: string;
        count?: number;
        recipients?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Gagal kirim digest");
        return;
      }
      if (data.skipped && data.reason === "already_sent") {
        setMessage(
          `Digest ${data.dayKey} sudah dikirim hari ini. Pakai “Kirim ulang” jika perlu.`
        );
        return;
      }
      setMessage(
        `Digest ${data.dayKey} terkirim ke ${(data.recipients ?? []).join(", ") || "recipient"} · ${data.count ?? 0} tiket.`
      );
    } finally {
      setDigestBusy(false);
    }
  }

  if (!can("ticket:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses antrian near-breach.
      </p>
    );
  }

  const sensitiveSelected = isSensitivePauseReason(pauseReason);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          auditWindowActive
            ? "border-sla-warning/40 bg-sla-warning/10 text-foreground"
            : "border-border bg-muted/30 text-muted-foreground"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{auditLabel}</span>
          <Badge variant={auditWindowActive ? "warning" : "secondary"}>
            {auditWindowActive ? "Jendela audit AKTIF" : "Di luar jendela 16:00"}
          </Badge>
          <span className="text-muted-foreground">
            Tiket WARNING/BREACHED (clock berjalan) — realokasi teknisi sebelum
            deadline.
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={digestBusy}
              onClick={() => void sendDigest(false)}
            >
              <Mail className="mr-1 h-3 w-3" /> Kirim digest
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={digestBusy}
              onClick={() => void sendDigest(true)}
            >
              Kirim ulang
            </Button>
          </div>
        </div>
      </div>

      {(error || message) && (
        <p className={`text-xs ${error ? "text-destructive" : "text-emerald-600"}`}>
          {error || message}
        </p>
      )}

      {canPause && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
          <label className="flex flex-col gap-1 text-[11px]">
            Alasan clock-stop (BRI)
            <select
              className="h-8 min-w-[220px] rounded-md border border-input bg-background px-2 text-xs"
              value={pauseReason}
              onChange={(e) =>
                setPauseReason(e.target.value as SlaPauseReasonCode)
              }
            >
              {SLA_PAUSE_REASON_CODES.map((c) => (
                <option key={c} value={c}>
                  {SLA_PAUSE_REASON_LABELS[c]}
                  {isSensitivePauseReason(c) ? " ★" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[11px]">
            Catatan
            <input
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={pauseNote}
              onChange={(e) => setPauseNote(e.target.value)}
              placeholder="Opsional (wajib jika Lainnya)"
            />
          </label>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
          {sensitiveSelected && !canApprove && (
            <p className="w-full text-[11px] text-sla-warning">
              Alasan ★ butuh approval Supervisor sebelum clock berhenti.
            </p>
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide">
              Antrian near-breach
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {rows.length} tiket · diurutkan rasio SLA tertinggi
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Tiket</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Elapsed</TableHead>
                <TableHead>Sisa / Over</TableHead>
                <TableHead>% SLA</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>SLA</TableHead>
                {canPause && <TableHead className="w-[120px]">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canPause ? 9 : 8}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    Tidak ada tiket near-breach saat ini.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {t.ticketNumber}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.merchantId}</TableCell>
                    <TableCell className="text-xs">
                      {LOCATION_LABELS[t.location] ?? t.location}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.elapsedLabel}</TableCell>
                    <TableCell className="font-mono text-xs text-sla-warning">
                      {t.remainingLabel}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {(t.elapsedRatio * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-xs">{t.vendorName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.slaStatus === "BREACHED" ? "breached" : "warning"
                        }
                      >
                        {SLA_LABELS[t.slaStatus as keyof typeof SLA_LABELS] ??
                          t.slaStatus}
                      </Badge>
                    </TableCell>
                    {canPause && (
                      <TableCell>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busyId === t.id}
                          onClick={() => void onPause(t.id)}
                          title={`Deadline ${formatDateTime(t.deadlineAt)}`}
                        >
                          <Clock className="mr-1 h-3 w-3" /> Stop
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
