"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
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
import type { BufferStockRow } from "@/data/dashboard";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import {
  applyStockMutation,
  type MutationAction,
} from "@/lib/inventory";
import { cn, formatPercent } from "@/lib/utils";

export function BufferStockModule({ initialRows }: { initialRows: BufferStockRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [action, setAction] = useState<MutationAction>("POOLING");
  const [fromRo, setFromRo] = useState(initialRows[0]?.regionalOffice ?? "");
  const [toRo, setToRo] = useState(
    initialRows.find((r) => r.belowThreshold)?.regionalOffice ??
      initialRows[1]?.regionalOffice ??
      ""
  );
  const [units, setUnits] = useState(2);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deficitCount = useMemo(
    () => rows.filter((r) => r.belowThreshold).length,
    [rows]
  );

  function handleMutation() {
    setMessage(null);
    setError(null);

    const result = applyStockMutation(rows, {
      action,
      fromRo: action === "IDLE_TO_BUFFER" ? fromRo : fromRo,
      toRo: action === "IDLE_TO_BUFFER" ? fromRo : toRo,
      units,
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setRows(result.rows);
    setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Threshold Buffer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-semibold tabular-nums">
              {BUFFER_STOCK_MIN_PERCENT}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Minimum per Regional Office</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>RO di Bawah Threshold</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "font-mono text-xl font-semibold tabular-nums",
                deficitCount > 0 ? "text-sla-breached" : "text-sla-safe"
              )}
            >
              {deficitCount}/{rows.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Perlu pooling / redistribusi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Total Unit Buffer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-semibold tabular-nums">
              {rows.reduce((sum, r) => sum + r.bufferUnits, 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Across all RO</p>
          </CardContent>
        </Card>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold tracking-wide">Distribusi Buffer Stock per RO</h2>
          <p className="text-xs text-muted-foreground">
            Status dihitung dari config inventory (min {BUFFER_STOCK_MIN_PERCENT}%)
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Regional Office</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Buffer</TableHead>
              <TableHead>Deployed</TableHead>
              <TableHead>Idle</TableHead>
              <TableHead>Buffer %</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.regionalOffice}>
                <TableCell className="font-medium">{row.regionalOffice}</TableCell>
                <TableCell className="font-mono text-xs">{row.totalUnits}</TableCell>
                <TableCell className="font-mono text-xs">{row.bufferUnits}</TableCell>
                <TableCell className="font-mono text-xs">{row.deployedUnits}</TableCell>
                <TableCell className="font-mono text-xs">{row.idleUnits}</TableCell>
                <TableCell className="font-mono text-xs">
                  {formatPercent(row.bufferPercent, 1)}
                </TableCell>
                <TableCell>
                  {row.belowThreshold ? (
                    <Badge variant="breached">Di bawah {BUFFER_STOCK_MIN_PERCENT}%</Badge>
                  ) : (
                    <Badge variant="safe">Aman</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ArrowRightLeft className="h-4 w-4" />
            Mutasi / Pooling Unit
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pindahkan idle/buffer dari RO surplus ke RO yang menipis, atau konversi idle → buffer.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Aksi</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={action}
                onChange={(e) => setAction(e.target.value as MutationAction)}
              >
                <option value="POOLING">Pooling (idle+buffer → tujuan)</option>
                <option value="TRANSFER_BUFFER">Transfer buffer saja</option>
                <option value="IDLE_TO_BUFFER">Idle → Buffer (RO sama)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Dari RO</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={fromRo}
                onChange={(e) => setFromRo(e.target.value)}
              >
                {rows.map((r) => (
                  <option key={r.regionalOffice} value={r.regionalOffice}>
                    {r.regionalOffice}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Ke RO</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                value={toRo}
                disabled={action === "IDLE_TO_BUFFER"}
                onChange={(e) => setToRo(e.target.value)}
              >
                {rows.map((r) => (
                  <option key={r.regionalOffice} value={r.regionalOffice}>
                    {r.regionalOffice}
                    {r.belowThreshold ? " · deficit" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Jumlah unit</span>
              <input
                type="number"
                min={1}
                className="h-9 rounded-md border border-input bg-background px-2 font-mono text-sm"
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleMutation}>
              Jalankan Mutasi
            </Button>
            {message && (
              <p className="inline-flex items-center gap-1.5 text-xs text-sla-safe">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {message}
              </p>
            )}
            {error && (
              <p className="inline-flex items-center gap-1.5 text-xs text-sla-breached">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
