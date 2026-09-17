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
import { REGIONAL_OFFICES } from "@/config/assets.config";
import type {
  DispatchCandidate,
  DispatchSuggestResult,
  RoCapacityRow,
} from "@/data/dispatch-store";

export function DispatchModule() {
  const { can } = useAuth();
  const [board, setBoard] = useState<RoCapacityRow[]>([]);
  const [suggest, setSuggest] = useState<DispatchSuggestResult | null>(null);
  const [targetRatio, setTargetRatio] = useState(25);
  const [ro, setRo] = useState<string>(REGIONAL_OFFICES[0] ?? "");
  const [ticketId, setTicketId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/ops/dispatch?board=1", { cache: "no-store" });
    const data = (await res.json()) as {
      board?: RoCapacityRow[];
      targetRatio?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat kapasitas");
      return;
    }
    setBoard(data.board ?? []);
    if (data.targetRatio) setTargetRatio(data.targetRatio);
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  async function runSuggest() {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (ticketId.trim()) qs.set("ticketId", ticketId.trim());
      else if (ro) qs.set("regionalOffice", ro);
      const res = await fetch(`/api/ops/dispatch?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        suggest?: DispatchSuggestResult;
        board?: RoCapacityRow[];
        targetRatio?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Gagal saran dispatch");
        return;
      }
      setSuggest(data.suggest ?? null);
      if (data.board) setBoard(data.board);
      if (data.targetRatio) setTargetRatio(data.targetRatio);
    } finally {
      setBusy(false);
    }
  }

  if (!can("ticket:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses saran dispatch.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Target coverage{" "}
        <strong className="text-foreground">1 teknisi : {targetRatio} merchant</strong>
        . Skor = beban tiket terbuka + kecocokan home RO + standby. Tanpa GIS —
        matching RO saja.
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <section className="rounded-md border border-border bg-card p-3">
        <h2 className="text-xs font-semibold tracking-wide">Saran dispatch</h2>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px]">
            Ticket id / nomor (opsional)
            <input
              className="h-8 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs font-mono"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="INC-2026-…"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            Atau pilih RO
            <select
              className="h-8 min-w-[160px] rounded-md border border-input bg-background px-2 text-xs"
              value={ro}
              onChange={(e) => setRo(e.target.value)}
              disabled={!!ticketId.trim()}
            >
              {REGIONAL_OFFICES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void runSuggest()}
          >
            Hitung saran
          </Button>
        </div>

        {suggest && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              RO: <strong className="text-foreground">{suggest.regionalOffice ?? "—"}</strong>
              {" · "}
              merchant {suggest.merchantsInRo} · tech {suggest.techCountInRo} /
              target {suggest.targetTechsForRo}
              {" · "}
              <Badge variant={suggest.capacityOk ? "safe" : "warning"}>
                {suggest.capacityOk ? "Kapasitas OK" : "Understaffed"}
              </Badge>
            </p>
            <CandidateTable candidates={suggest.candidates} />
          </div>
        )}
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide">
              Kapasitas per RO
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Rasio aktual merchant ÷ teknisi vs target 1:{targetRatio}
            </p>
          </div>
          <Button type="button" size="xs" variant="outline" onClick={() => void loadBoard()}>
            Refresh
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RO</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Tech</TableHead>
              <TableHead>Target tech</TableHead>
              <TableHead>Rasio aktual</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {board.map((r) => (
              <TableRow key={r.regionalOffice}>
                <TableCell className="text-xs">{r.regionalOffice}</TableCell>
                <TableCell className="font-mono text-xs">{r.merchantCount}</TableCell>
                <TableCell className="font-mono text-xs">{r.techCount}</TableCell>
                <TableCell className="font-mono text-xs">{r.targetTechs}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.actualRatio == null
                    ? r.merchantCount > 0
                      ? "∞"
                      : "—"
                    : `1:${r.actualRatio}`}
                </TableCell>
                <TableCell>
                  {r.understaffed || r.overloaded ? (
                    <Badge variant="warning">
                      {r.understaffed ? "Kurang tech" : "Overload"}
                    </Badge>
                  ) : (
                    <Badge variant="safe">OK</Badge>
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

function CandidateTable({ candidates }: { candidates: DispatchCandidate[] }) {
  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Tidak ada kandidat VENDOR_TECH aktif.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Teknisi</TableHead>
          <TableHead>Open</TableHead>
          <TableHead>Home RO</TableHead>
          <TableHead>Skor</TableHead>
          <TableHead>Alasan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((c) => (
          <TableRow key={c.userId}>
            <TableCell className="text-xs font-medium">
              {c.name}
              {c.standby ? (
                <Badge variant="outline" className="ml-1">
                  standby
                </Badge>
              ) : null}
            </TableCell>
            <TableCell className="font-mono text-xs">{c.openTickets}</TableCell>
            <TableCell className="text-[11px] text-muted-foreground">
              {c.homeRos.join(", ") || "—"}
            </TableCell>
            <TableCell className="font-mono text-xs">{c.score.toFixed(2)}</TableCell>
            <TableCell className="text-[11px] text-muted-foreground">
              {c.reasons.join(" · ")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Compact chips for ticketing Dispatch field. */
export function DispatchSuggestChips({
  ticketId,
  onPick,
}: {
  ticketId?: string | null;
  onPick: (name: string) => void;
}) {
  const [candidates, setCandidates] = useState<DispatchCandidate[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/ops/dispatch?ticketId=${encodeURIComponent(ticketId)}&limit=3`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as {
        suggest?: DispatchSuggestResult;
      };
      if (cancelled) return;
      setCandidates(data.suggest?.candidates ?? []);
      if (data.suggest) {
        setHint(
          data.suggest.capacityOk
            ? null
            : `${data.suggest.regionalOffice ?? "RO"} understaffed vs 1:${data.suggest.targetRatio}`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (!ticketId || candidates.length === 0) return null;

  return (
    <div className="mt-1 space-y-1">
      {hint && <p className="text-[10px] text-sla-warning">{hint}</p>}
      <div className="flex flex-wrap gap-1">
        {candidates.map((c) => (
          <button
            key={c.userId}
            type="button"
            className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted"
            title={c.reasons.join(" · ")}
            onClick={() => onPick(c.name)}
          >
            {c.name} · {c.score.toFixed(2)}
          </button>
        ))}
      </div>
    </div>
  );
}
