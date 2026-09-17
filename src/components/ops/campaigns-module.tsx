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
import type { CampaignRunRow } from "@/data/pm-campaign-store";
import type { PeakSeasonStatus } from "@/config/peak-season.config";
import { formatDateTime } from "@/lib/utils";

type PmSnap = {
  periodKey: string;
  generateDayOfMonth: number;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    merchantId: string;
    location: string;
    status: string;
    description: string;
  }>;
  monthlyRun: CampaignRunRow | null;
  regionalOffices: string[];
};

type PeakSnap = {
  asOf: string;
  seasons: PeakSeasonStatus[];
  active: PeakSeasonStatus[];
  intensifyDue: PeakSeasonStatus[];
};

export function CampaignsModule() {
  const { can } = useAuth();
  const canGenerate = can("ticket:create");
  const [pm, setPm] = useState<PmSnap | null>(null);
  const [peak, setPeak] = useState<PeakSnap | null>(null);
  const [runs, setRuns] = useState<CampaignRunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/ops/campaigns", { cache: "no-store" });
    const data = (await res.json()) as {
      pm?: PmSnap;
      peak?: PeakSnap;
      runs?: CampaignRunRow[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat kampanye");
      return;
    }
    setPm(data.pm ?? null);
    setPeak(data.peak ?? null);
    setRuns(data.runs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/ops/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        created?: unknown[];
        skipped?: number;
        periodKey?: string;
        notified?: boolean;
        season?: PeakSeasonStatus;
      };
      if (!res.ok) {
        setError(data.error || "Gagal");
        return;
      }
      if (body.action === "generate_pm") {
        setMessage(
          `PM ${data.periodKey}: ${(data.created as unknown[])?.length ?? 0} dibuat, ${data.skipped ?? 0} skip (sudah ada).`
        );
      } else {
        setMessage(
          `Intensifikasi ${data.season?.window.name ?? ""} dicatat${data.notified ? " + notifikasi dikirim" : ""}.`
        );
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!can("ticket:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses kalender PM / peak season.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {(error || message) && (
        <p className={`text-xs ${error ? "text-destructive" : "text-emerald-600"}`}>
          {error || message}
        </p>
      )}

      {/* Peak season */}
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">
            Peak season playbook
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Natal · Tahun Baru · Lebaran — alert intensifikasi & checklist buffer
          </p>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-3">
          {(peak?.seasons ?? []).map((s) => (
            <div
              key={s.window.id}
              className={`rounded-md border p-3 text-xs ${
                s.state === "ACTIVE"
                  ? "border-sla-warning/40 bg-sla-warning/10"
                  : s.intensifyDue
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{s.window.name}</span>
                <Badge
                  variant={
                    s.state === "ACTIVE"
                      ? "warning"
                      : s.state === "UPCOMING"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {s.state}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {s.window.startDate} → {s.window.endDate}
              </p>
              <p className="mt-1 text-muted-foreground">
                Buffer floor ≥{s.window.bufferFloorPercent}%
                {s.state === "UPCOMING" && s.daysUntilStart > 0
                  ? ` · H-${s.daysUntilStart}`
                  : ""}
              </p>
              <ul className="mt-2 list-inside list-disc text-[11px] text-muted-foreground">
                {s.window.checklist.slice(0, 3).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {canGenerate && s.intensifyDue && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="mt-2"
                  disabled={busy}
                  onClick={() =>
                    void post({
                      action: "peak_intensify",
                      peakId: s.window.id,
                    })
                  }
                >
                  Jalankan intensifikasi
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* PM calendar */}
      <section className="rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide">
              Kalender PM bulanan
            </h2>
            <p className="text-[11px] text-muted-foreground">
              REQUEST + PM · periode{" "}
              <span className="font-mono">{pm?.periodKey ?? "…"}</span> · 1 tiket /
              RO
            </p>
          </div>
          <div className="flex gap-1">
            {pm?.monthlyRun && (
              <Badge variant="safe">
                Run {pm.monthlyRun.status} · {pm.monthlyRun.ticketCount} tiket
              </Badge>
            )}
            {canGenerate && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void post({
                    action: "generate_pm",
                    periodKey: pm?.periodKey,
                  })
                }
              >
                Generate PM bulan ini
              </Button>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Tiket</TableHead>
              <TableHead>Merchant / RO key</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deskripsi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pm?.tickets.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Belum ada tiket PM untuk periode ini. Klik Generate atau jadwalkan
                  cron `/api/cron/pm-monthly`.
                </TableCell>
              </TableRow>
            ) : (
              pm!.tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {t.ticketNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.merchantId}</TableCell>
                  <TableCell className="text-xs">{t.location}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px] text-[11px] text-muted-foreground">
                    {t.description}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* Run log */}
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">Log kampanye</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  Belum ada run.
                </TableCell>
              </TableRow>
            ) : (
              runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-[11px]">
                    {formatDateTime(r.generatedAt)}
                  </TableCell>
                  <TableCell className="text-xs">{r.kind}</TableCell>
                  <TableCell className="font-mono text-xs">{r.periodKey}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.ticketCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
