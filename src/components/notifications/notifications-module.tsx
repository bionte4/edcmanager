"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
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
import type { NotificationRecord } from "@/data/notifications-store";
import { formatDateTime } from "@/lib/utils";

function statusVariant(
  status: NotificationRecord["status"]
): "safe" | "warning" | "breached" | "secondary" {
  if (status === "SENT" || status === "SIMULATED") return "safe";
  if (status === "QUEUED") return "warning";
  if (status === "FAILED") return "breached";
  return "secondary";
}

export function NotificationsModule() {
  const [rows, setRows] = useState<NotificationRecord[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const data = (await res.json()) as {
      notifications?: NotificationRecord[];
      smtpConfigured?: boolean;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat notifikasi");
      return;
    }
    setRows(data.notifications ?? []);
    setSmtpConfigured(Boolean(data.smtpConfigured));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendTest() {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Test gagal");
      return;
    }
    setMessage(
      smtpConfigured
        ? "Test email dikirim via SMTP."
        : "SMTP belum dikonfigurasi — email disimulasikan (lihat log)."
    );
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>SMTP Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={smtpConfigured ? "safe" : "warning"}>
              {smtpConfigured ? "Configured" : "Simulated (no SMTP env)"}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              Isi SMTP_HOST / USER / PASS di .env untuk kirim nyata.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Logged Emails</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button type="button" size="sm" onClick={() => void sendTest()}>
              <Send className="h-3.5 w-3.5" />
              Send test email
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
            {message && <p className="text-xs text-sla-safe">{message}</p>}
            {error && <p className="text-xs text-sla-breached">{error}</p>}
          </CardContent>
        </Card>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Mail className="h-4 w-4" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide">Notification Log</h2>
            <p className="text-xs text-muted-foreground">
              Assign, SLA Warning/Breach, dan test SMTP
            </p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ticket</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Belum ada notifikasi. Kirim test atau trigger dari Ticketing.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.event}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.toAddress}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs">
                    {row.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.ticketNumber || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
