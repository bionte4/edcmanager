"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { LOCATION_LABELS, SLA_LABELS } from "@/data/dashboard";
import type { EscalationInboxRow } from "@/data/liaison-store";
import { formatDateTime } from "@/lib/utils";

export function EscalationInboxModule() {
  const { can } = useAuth();
  const canEscalate = can("liaison:escalate");
  const [rows, setRows] = useState<EscalationInboxRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/liaison", { cache: "no-store" });
    const data = (await res.json()) as {
      inbox?: EscalationInboxRow[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat inbox eskalasi");
      return;
    }
    setRows(data.inbox ?? []);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function escalate(ticketId: string) {
    if (!canEscalate) return;
    setBusyId(ticketId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/liaison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "escalate",
          ticketId,
          note: note || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal eskalasi");
        return;
      }
      setMessage("Tiket ditandai eskalasi ke Liaison LO.");
      setNote("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!can("liaison:read") && !can("liaison:escalate")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses inbox eskalasi.
      </p>
    );
  }

  // Escalators without full liaison:read still need data — API requires liaison:read.
  // NOC has escalate but not read — grant GET for escalate holders via API change.
  // For now show hint if they can't load.
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-sla-warning/30 bg-sla-warning/5 px-3 py-2 text-xs">
        Inbox tiket SLA/OLA yang butuh perhatian LO — sinkron dengan near-breach &
        flag eskalasi ticketing.
      </div>

      {(error || message) && (
        <p className={`text-xs ${error ? "text-destructive" : "text-emerald-600"}`}>
          {error || message}
        </p>
      )}

      {canEscalate && (
        <input
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          placeholder="Catatan eskalasi (opsional) — dipakai saat klik Eskalasi LO"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide">Inbox eskalasi</h2>
            <p className="text-[11px] text-muted-foreground">
              {rows.length} tiket terbuka
            </p>
          </div>
          <Button type="button" size="xs" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Tiket</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Elapsed</TableHead>
              <TableHead>Flag</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead className="w-[160px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Tidak ada tiket yang perlu eskalasi saat ini.
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
                  <TableCell className="font-mono text-xs">
                    {t.elapsedLabel}
                    <span className="text-muted-foreground">
                      {" "}
                      · {t.remainingLabel}
                    </span>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {t.needsEscalation && <Badge variant="warning">SLA</Badge>}
                    {t.olaNeedsEscalation && (
                      <Badge variant="outline">OLA</Badge>
                    )}
                    {t.escalatedAt && (
                      <Badge variant="secondary" title={formatDateTime(t.escalatedAt)}>
                        Logged
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.slaStatus === "BREACHED"
                          ? "breached"
                          : t.slaStatus === "WARNING"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {SLA_LABELS[t.slaStatus as keyof typeof SLA_LABELS] ??
                        t.slaStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button type="button" size="xs" variant="ghost" asChild>
                      <Link href="/ticketing">Buka</Link>
                    </Button>
                    {canEscalate && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busyId === t.id}
                        onClick={() => void escalate(t.id)}
                      >
                        Eskalasi LO
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
