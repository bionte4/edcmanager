"use client";

import { useCallback, useEffect, useState } from "react";
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
import type { IngestEventRow } from "@/data/monitoring-ingest-store";
import { formatDateTime } from "@/lib/utils";

type ConfigSnap = {
  createTicketSeverities: readonly string[];
  severityToCategory: Record<string, string>;
  defaultLocation: string;
};

function outcomeVariant(
  outcome: string
): "safe" | "warning" | "breached" | "secondary" | "outline" {
  if (outcome === "TICKET_CREATED") return "safe";
  if (outcome === "DUPLICATE") return "secondary";
  if (outcome === "IGNORED") return "outline";
  if (outcome === "ERROR") return "breached";
  return "warning";
}

export function MonitoringIngestPanel() {
  const [events, setEvents] = useState<IngestEventRow[]>([]);
  const [config, setConfig] = useState<ConfigSnap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/integrations/monitoring", { cache: "no-store" });
    const data = (await res.json()) as {
      events?: IngestEventRow[];
      config?: ConfigSnap;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat ingest log");
      return;
    }
    setEvents(data.events ?? []);
    setConfig(data.config ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-foreground">
              Monitoring → Incident (Fase C)
            </CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Webhook uptime/diagnostic auto-create tiket CRITICAL/MAJOR. Scope:{" "}
              <code className="font-mono">monitoring:ingest</code>
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          {config && (
            <p>
              Buat tiket jika severity ∈{" "}
              <strong className="text-foreground">
                {config.createTicketSeverities.join(", ")}
              </strong>
              {" · "}default lokasi{" "}
              <code className="font-mono text-foreground">{config.defaultLocation}</code>
              {" · "}CRITICAL/MAJOR → VIP
            </p>
          )}
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-2.5 font-mono text-[11px] text-foreground">
{`curl -s -X POST http://localhost:3000/api/v1/monitoring/events \\
  -H "Authorization: Bearer edc_sk_demo_monitoring_change_me" \\
  -H "Content-Type: application/json" \\
  -d '{
    "eventId": "evt-demo-001",
    "severity": "CRITICAL",
    "serialNumber": "SN-DEMO-001",
    "alertCode": "DEVICE_DOWN",
    "message": "EDC offline > 5 menit"
  }'`}
          </pre>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">Ingest log</h2>
          <p className="text-[11px] text-muted-foreground">
            {events.length} event terbaru
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>SN / MID</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Tiket</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Belum ada event. Kirim webhook uji dari contoh curl di atas.
                </TableCell>
              </TableRow>
            ) : (
              events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-[11px]">
                    {formatDateTime(e.receivedAt)}
                  </TableCell>
                  <TableCell className="text-xs">{e.sourceSystem}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.severityCode ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {e.serialNumber ?? "—"}
                    {e.merchantId ? (
                      <span className="text-muted-foreground"> / {e.merchantId}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={outcomeVariant(e.outcome)}>{e.outcome}</Badge>
                    {e.errorMessage ? (
                      <p className="mt-0.5 max-w-[200px] text-[10px] text-destructive">
                        {e.errorMessage}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.ticketNumber ?? "—"}
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
